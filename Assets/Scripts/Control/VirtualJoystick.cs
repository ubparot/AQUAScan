using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace AQUAScan.Control
{
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public RectTransform Background;
        public RectTransform Handle;
        [Range(0.2f, 1f)] public float HandleRange = 0.72f;
        public bool Interactable = true;

        public Vector2 Value { get; private set; }

        public event Action<Vector2> OnValueChanged;

        public void Configure(RectTransform background, RectTransform handle)
        {
            Background = background;
            Handle = handle;
            ResetState();
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (!Interactable)
                return;

            UpdatePointer(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (!Interactable)
                return;

            UpdatePointer(eventData);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (!Interactable)
                return;

            ResetState();
        }

        public void ResetState()
        {
            SetValue(Vector2.zero);
        }

        private void UpdatePointer(PointerEventData eventData)
        {
            if (Background == null)
                return;

            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(Background, eventData.position, eventData.pressEventCamera, out var localPoint))
                return;

            Vector2 extents = Background.rect.size * 0.5f;
            if (extents.x <= 0f || extents.y <= 0f)
                return;

            var normalized = new Vector2(localPoint.x / extents.x, localPoint.y / extents.y);
            if (normalized.magnitude > 1f)
                normalized = normalized.normalized;

            SetValue(normalized);
        }

        private void SetValue(Vector2 value)
        {
            Value = Vector2.ClampMagnitude(value, 1f);
            if (Handle != null && Background != null)
            {
                Vector2 handleRange = Background.rect.size * 0.5f * HandleRange;
                Handle.anchoredPosition = new Vector2(Value.x * handleRange.x, Value.y * handleRange.y);
            }

            OnValueChanged?.Invoke(Value);
        }
    }
}
