using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace AQUAScan.Control
{
    public sealed class Esp8266WebSocketClient : IDisposable
    {
        private readonly ConcurrentQueue<DriveStatus> _statusQueue = new ConcurrentQueue<DriveStatus>();
        private readonly ConcurrentQueue<LiveTransportEvent> _eventQueue = new ConcurrentQueue<LiveTransportEvent>();
        private readonly SemaphoreSlim _sendLock = new SemaphoreSlim(1, 1);

        private ClientWebSocket _socket;
        private CancellationTokenSource _lifetimeCts;
        private Task _receiveLoopTask;

        public bool IsConnected => _socket != null && _socket.State == WebSocketState.Open;

        public async Task<bool> ConnectAsync(string host, int port)
        {
            await DisconnectAsync("Reconnecting");

            _lifetimeCts = new CancellationTokenSource();
            _socket = new ClientWebSocket();

            try
            {
                var endpoint = new Uri($"ws://{host}:{port}/");
                await _socket.ConnectAsync(endpoint, _lifetimeCts.Token);
                QueueEvent(LiveTransportEventType.ConnectionChanged, true, $"Connected to {endpoint}");
                _receiveLoopTask = Task.Run(() => ReceiveLoopAsync(_socket, _lifetimeCts.Token));
                await SendHelloAsync("AquaScan", Application.version);
                return true;
            }
            catch (Exception ex)
            {
                QueueEvent(LiveTransportEventType.Error, false, $"Connect failed: {ex.Message}");
                await DisconnectAsync("Connect failed");
                return false;
            }
        }

        public async Task DisconnectAsync(string message = "Disconnected")
        {
            var socket = _socket;
            var lifetime = _lifetimeCts;

            _socket = null;
            _lifetimeCts = null;

            if (lifetime != null)
            {
                try
                {
                    lifetime.Cancel();
                }
                catch
                {
                }
            }

            if (socket != null)
            {
                try
                {
                    if (socket.State == WebSocketState.Open || socket.State == WebSocketState.CloseReceived)
                        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, message, CancellationToken.None);
                }
                catch
                {
                }

                socket.Dispose();
            }

            lifetime?.Dispose();
            QueueEvent(LiveTransportEventType.ConnectionChanged, false, message);
        }

        public Task<bool> SendHelloAsync(string client, string version)
        {
            var message = new HelloMessage
            {
                type = "hello",
                client = client,
                version = string.IsNullOrWhiteSpace(version) ? "0.1.0" : version
            };
            return SendJsonAsync(message);
        }

        public Task<bool> SendDriveAsync(DriveCommand command)
        {
            var message = new DriveMessage
            {
                type = "drive",
                seq = command.Seq,
                armed = command.Armed,
                estop = command.EStop,
                x = command.JoystickX,
                y = command.JoystickY,
                left = command.LeftMicros,
                right = command.RightMicros
            };
            return SendJsonAsync(message);
        }

        public Task<bool> SendEstopAsync(int seq)
        {
            var message = new EStopMessage
            {
                type = "estop",
                seq = seq
            };
            return SendJsonAsync(message);
        }

        public bool TryDequeueStatus(out DriveStatus status)
        {
            return _statusQueue.TryDequeue(out status);
        }

        public bool TryDequeueEvent(out LiveTransportEvent transportEvent)
        {
            return _eventQueue.TryDequeue(out transportEvent);
        }

        public void Dispose()
        {
            if (_socket != null || _lifetimeCts != null)
                _ = DisconnectAsync("Disposed");
            _sendLock.Dispose();
        }

        private async Task<bool> SendJsonAsync(object payload)
        {
            if (!IsConnected)
                return false;

            string json = JsonUtility.ToJson(payload);
            var data = Encoding.UTF8.GetBytes(json);
            await _sendLock.WaitAsync();
            try
            {
                if (!IsConnected)
                    return false;

                await _socket.SendAsync(new ArraySegment<byte>(data), WebSocketMessageType.Text, true, _lifetimeCts.Token);
                return true;
            }
            catch (Exception ex)
            {
                QueueEvent(LiveTransportEventType.Error, false, $"Send failed: {ex.Message}");
                await DisconnectAsync("Send failed");
                return false;
            }
            finally
            {
                _sendLock.Release();
            }
        }

        private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken token)
        {
            var buffer = new byte[1024];

            try
            {
                while (!token.IsCancellationRequested && socket.State == WebSocketState.Open)
                {
                    using (var stream = new MemoryStream())
                    {
                        WebSocketReceiveResult result;
                        do
                        {
                            result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                            if (result.MessageType == WebSocketMessageType.Close)
                            {
                                await DisconnectAsync("Socket closed");
                                return;
                            }

                            if (result.Count > 0)
                                stream.Write(buffer, 0, result.Count);
                        }
                        while (!result.EndOfMessage);

                        string json = Encoding.UTF8.GetString(stream.ToArray());
                        ParseIncomingMessage(json);
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                QueueEvent(LiveTransportEventType.Error, false, $"Receive failed: {ex.Message}");
            }

            if (!token.IsCancellationRequested)
                await DisconnectAsync("Socket receive loop ended");
        }

        private void ParseIncomingMessage(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return;

            StatusMessage message;
            try
            {
                message = JsonUtility.FromJson<StatusMessage>(json);
            }
            catch (Exception ex)
            {
                QueueEvent(LiveTransportEventType.Error, false, $"Bad status JSON: {ex.Message}");
                return;
            }

            if (message == null || !string.Equals(message.type, "status", StringComparison.OrdinalIgnoreCase))
                return;

            var status = new DriveStatus
            {
                Connected = message.connected,
                Armed = message.armed,
                EStop = message.estop,
                LastSeq = message.lastSeq,
                LeftMicros = message.left <= 0 ? EscPulseMapper.NeutralMicros : message.left,
                RightMicros = message.right <= 0 ? EscPulseMapper.NeutralMicros : message.right,
                LastSeenUtc = DateTime.UtcNow,
                Rssi = message.rssi
            };

            _statusQueue.Enqueue(status);
        }

        private void QueueEvent(LiveTransportEventType type, bool connected, string message)
        {
            _eventQueue.Enqueue(new LiveTransportEvent
            {
                Type = type,
                Connected = connected,
                Message = message
            });
        }

        [Serializable]
#pragma warning disable CS0649
        private sealed class HelloMessage
        {
            public string type;
            public string client;
            public string version;
        }

        [Serializable]
        private sealed class DriveMessage
        {
            public string type;
            public int seq;
            public bool armed;
            public bool estop;
            public float x;
            public float y;
            public int left;
            public int right;
        }

        [Serializable]
        private sealed class EStopMessage
        {
            public string type;
            public int seq;
        }

        [Serializable]
        private sealed class StatusMessage
        {
            public string type;
            public bool connected;
            public bool armed;
            public bool estop;
            public int lastSeq;
            public int left;
            public int right;
            public int rssi;
        }
#pragma warning restore CS0649
    }
}
