namespace AQUAScan.Control
{
    public enum LiveTransportEventType
    {
        ConnectionChanged,
        Info,
        Error
    }

    public struct LiveTransportEvent
    {
        public LiveTransportEventType Type;
        public bool Connected;
        public string Message;
    }
}
