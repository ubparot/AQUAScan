using AQUAScan.Visualization;
using UnityEditor;
using UnityEngine;

namespace AQUAScan.Editor
{
    [CustomEditor(typeof(AquaSceneOverhaul))]
    public class AquaSceneOverhaulEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();

            EditorGUILayout.Space();
            if (GUILayout.Button("Apply Overhaul"))
            {
                var overhaul = (AquaSceneOverhaul)target;
                overhaul.ApplyOverhaul();
                EditorUtility.SetDirty(overhaul);
            }
        }
    }
}
