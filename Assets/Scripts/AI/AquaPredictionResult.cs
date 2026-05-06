using System;

namespace AQUAScan.AI
{
    [Serializable]
    public class AquaPredictionResult
    {
        public float OxygenNow;
        public float Oxygen30Minutes;
        public float Oxygen60Minutes;
        public float Oxygen120Minutes;
        public float BloomRisk;
        public float AnomalyRisk;
        public bool ModelArtifactLoaded;
        public bool NormalizationLoaded;
        public string BackendName;
        public string Status;
    }
}
