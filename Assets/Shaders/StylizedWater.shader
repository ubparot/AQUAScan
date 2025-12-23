Shader "AQUAScan/RealisticWater_Pro"
{
    Properties
    {
        [Header(Water Colors)]
        _ShallowColor("Shallow Color", Color) = (0.30, 0.75, 0.90, 0.45)
        _DeepColor   ("Deep Color",    Color) = (0.02, 0.08, 0.18, 0.90)
        _FoamColor   ("Foam Color",    Color) = (1, 1, 1, 1)

        [Header(Heatmap Integration)]
        _HeatmapIntensity("Heatmap Intensity", Range(0,1)) = 1.0
        _HeatmapTintStrength("Heatmap Tint Strength", Range(0,2)) = 1.0
        _HeatmapEmission("Heatmap Emission", Range(0,1)) = 0.1
        _HeatmapAlphaMin("Heatmap Fade Min", Range(0,1)) = 0.35
        _HeatmapAlphaMax("Heatmap Fade Max", Range(0,1)) = 0.9

        [Header(Waves  Geometry)]
        _WaveSpeed ("Wave Speed", Float) = 1.0
        _WaveScale ("Wave Scale", Float) = 0.35
        _WaveHeight("Wave Height", Float) = 0.18
        _Chop      ("Wave Chop (X/Z)", Range(0,1)) = 0.15

        [Header(Normal Maps  Surface Detail)]
        [NoScaleOffset]_NormalA("Normal A", 2D) = "bump" {}
        [NoScaleOffset]_NormalB("Normal B", 2D) = "bump" {}
        _NormalStrength("Normal Strength", Range(0,3)) = 1.25
        _NormalTilingA ("Normal Tiling A", Float) = 0.35
        _NormalTilingB ("Normal Tiling B", Float) = 0.75
        _NormalSpeedA  ("Normal Speed A (XY)", Vector) = (0.05, 0.03, 0, 0)
        _NormalSpeedB  ("Normal Speed B (XY)", Vector) = (-0.03, 0.06, 0, 0)

        [Header(Depth Absorption)]
        _DepthDistance ("Depth Fade Distance", Float) = 6.0
        _Absorption    ("Absorption Strength", Range(0,10)) = 3.0
        _Scatter       ("Shallow Scatter Boost", Range(0,2)) = 0.35

        [Header(Refraction)]
        _RefractionStrength("Refraction Strength", Range(0,0.1)) = 0.03
        _RefractionDepthFade("Refraction Depth Fade", Range(0,1)) = 0.65

        [Header(Foam)]
        [NoScaleOffset]_FoamNoise("Foam Noise", 2D) = "white" {}
        _FoamSize   ("Foam Shore Width", Float) = 0.6
        _FoamCutoff ("Foam Cutoff", Range(0,1)) = 0.25
        _FoamTiling ("Foam Tiling", Float) = 0.35
        _FoamSpeed  ("Foam Speed (XY)", Vector) = (0.04, -0.02, 0, 0)
        _CrestFoam  ("Crest Foam Amount", Range(0,2)) = 0.6

        [Header(Lighting)]
        _Smoothness   ("Smoothness", Range(0,1)) = 0.92
        _SpecularColor("Specular Color", Color) = (1,1,1,1)
        _FresnelPower ("Fresnel Power", Float) = 5.5

        [Header(Caustics (Optional))]
        _CausticsStrength("Caustics Strength", Range(0,1)) = 0.25
        _CausticsScale   ("Caustics Scale", Float) = 1.25
        _CausticsSpeed   ("Caustics Speed", Float) = 0.5
    }

    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" }
        LOD 350

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }

            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareOpaqueTexture.hlsl"

            TEXTURE2D(_NormalA); SAMPLER(sampler_NormalA);
            TEXTURE2D(_NormalB); SAMPLER(sampler_NormalB);
            TEXTURE2D(_FoamNoise); SAMPLER(sampler_FoamNoise);

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv         : TEXCOORD0;
                float4 color      : COLOR;   // heatmap color (rgb) + heatmap mask (a)
                float3 normalOS   : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD1;
                float2 uv         : TEXCOORD0;
                float4 color      : COLOR;
                float3 normalWS   : TEXCOORD3;
                float3 viewDirWS  : TEXCOORD4;
            };

            CBUFFER_START(UnityPerMaterial)
                float4 _ShallowColor;
                float4 _DeepColor;
                float4 _FoamColor;

                float _HeatmapIntensity;
                float _HeatmapTintStrength;
                float _HeatmapEmission;
                float _HeatmapAlphaMin;
                float _HeatmapAlphaMax;

                float _WaveSpeed;
                float _WaveScale;
                float _WaveHeight;
                float _Chop;

                float _NormalStrength;
                float _NormalTilingA;
                float _NormalTilingB;
                float4 _NormalSpeedA;
                float4 _NormalSpeedB;

                float _DepthDistance;
                float _Absorption;
                float _Scatter;

                float _RefractionStrength;
                float _RefractionDepthFade;

                float _FoamSize;
                float _FoamCutoff;
                float _FoamTiling;
                float4 _FoamSpeed;
                float _CrestFoam;

                float _Smoothness;
                float4 _SpecularColor;
                float _FresnelPower;

                float _CausticsStrength;
                float _CausticsScale;
                float _CausticsSpeed;
            CBUFFER_END

            // ---- Helpers ----
            float2 Hash2(float2 p)
            {
                p = float2(dot(p, float2(127.1, 311.7)), dot(p, float2(269.5, 183.3)));
                return frac(sin(p) * 43758.5453);
            }

            // Cheap caustics-ish pattern (not physically perfect, but sells the look)
            float Caustics(float2 uv, float t)
            {
                uv *= _CausticsScale;
                float2 p = uv;
                float a = 0;
                [unroll] for (int i = 0; i < 3; i++)
                {
                    float2 h = Hash2(floor(p));
                    p += (h - 0.5) * 0.65;
                    a += sin(p.x + t) * cos(p.y - t);
                    p = p.yx * 1.37;
                }
                return saturate(a * 0.18 + 0.5);
            }

            // Geometry waves (simple + stable). Adds slight horizontal "chop" for realism.
            float3 GetWaveDisplacement(float3 posWS, float t)
            {
                float h = 0;
                float2 chop = 0;

                // We'll iterate through 4 layers of "randomized" waves
                // Using different primes/fractions to prevent repeating patterns
                float frequencies[4] = { 1.0, 1.45, 2.11, 3.17 };
                float amplitudes[4] = { 0.5, 0.25, 0.15, 0.1 };
                float speeds[4] = { 1.0, 1.3, 1.8, 2.4 };

                for(int i = 0; i < 4; i++)
                {
                    // Use the loop index as a seed for Hash2 to get a "random" direction
                    float2 seed = float2(float(i) * 15.23, float(i) * 37.55);
                    float2 dir = normalize(Hash2(seed) - 0.5);

                    float x = dot(posWS.xz, dir) * (_WaveScale * frequencies[i]) + (t * speeds[i]);
                    
                    float wave = sin(x);
                    h += wave * amplitudes[i];

                    // Horizontal "Chop" displacement
                    chop += dir * (cos(x) * amplitudes[i] * _Chop);
                }

                return float3(chop.x, h * _WaveHeight, chop.y);
            }

            float3 ComputeWaveNormal(float3 posWS, float t)
            {
                // sample neighbor points to build a geometric normal
                const float eps = 0.12;
                float3 p  = posWS;
                float3 px = posWS + float3(eps, 0, 0);
                float3 pz = posWS + float3(0, 0, eps);

                float3 dp  = GetWaveDisplacement(p,  t);
                float3 dpx = GetWaveDisplacement(px, t);
                float3 dpz = GetWaveDisplacement(pz, t);

                float3 wp  = p  + dp;
                float3 wpx = px + dpx;
                float3 wpz = pz + dpz;

                float3 tangent   = normalize(wpx - wp);
                float3 bitangent = normalize(wpz - wp);
                return normalize(cross(bitangent, tangent));
            }

            float3 UnpackNormalScale(TEXTURE2D_PARAM(tex, samp), float2 uv, float strength)
            {
                float4 n = SAMPLE_TEXTURE2D(tex, samp, uv);
                float3 nn = UnpackNormal(n);
                nn.xy *= strength;
                return normalize(nn);
            }

            float3 BlendNormalsRNM(float3 n1, float3 n2)
            {
                // Reoriented Normal Mapping blend
                float3 t = float3(n1.xy, n1.z);
                float3 u = float3(n2.xy, n2.z);
                float3 r = float3(t.xy + u.xy, t.z * u.z);
                return normalize(r);
            }

            Varyings Vert(Attributes IN)
            {
                Varyings OUT;

                float3 worldPos = TransformObjectToWorld(IN.positionOS.xyz);
                float t = _Time.y * _WaveSpeed;

                // 1) geometry displacement
                worldPos += GetWaveDisplacement(worldPos, t);

                OUT.positionWS = worldPos;
                OUT.positionCS = TransformWorldToHClip(worldPos);

                // 2) geometric wave normal
                OUT.normalWS = ComputeWaveNormal(worldPos, t);

                OUT.viewDirWS = GetWorldSpaceNormalizeViewDir(worldPos);
                OUT.uv = IN.uv;
                OUT.color = IN.color;

                return OUT;
            }

  // Inside Shader "AQUAScan/RealisticWater_Pro" -> SubShader -> Pass

// Inside Shader "AQUAScan/RealisticWater_Pro" -> SubShader -> Pass

half4 Frag(Varyings IN) : SV_Target
{
    // ---- Screen UV & Depth ----
    float4 screenPos = ComputeScreenPos(IN.positionCS);
    float2 uvScreen = screenPos.xy / screenPos.w;

    float rawDepth = SampleSceneDepth(uvScreen);
    float sceneDepth = LinearEyeDepth(rawDepth, _ZBufferParams);
    float surfaceDepth = LinearEyeDepth(IN.positionCS.z, _ZBufferParams);
    float waterDepth = max(0, sceneDepth - surfaceDepth);
    float depth01 = saturate(waterDepth / max(0.0001, _DepthDistance));

    // ---- Normals & Surface Detail ----
    float t = _Time.y * _WaveSpeed;
    float2 uvA = IN.positionWS.xz * _NormalTilingA + _NormalSpeedA.xy * t;
    float2 uvB = IN.positionWS.xz * _NormalTilingB + _NormalSpeedB.xy * t;

    float3 nA = UnpackNormalScale(TEXTURE2D_ARGS(_NormalA, sampler_NormalA), uvA, _NormalStrength);
    float3 nB = UnpackNormalScale(TEXTURE2D_ARGS(_NormalB, sampler_NormalB), uvB, _NormalStrength * 0.75);
    float3 nDetailTS = BlendNormalsRNM(nA, nB);
    float3 normalWS = normalize(IN.normalWS + float3(nDetailTS.x, 0, nDetailTS.y) * 0.6);
    float3 viewDir = normalize(IN.viewDirWS);

    // ---- Base Water Appearance ----
    float3 shallow = _ShallowColor.rgb;
    float3 deep    = _DeepColor.rgb;
    float absorb = exp(-waterDepth * _Absorption * 0.15);
    float3 depthTint = lerp(deep, shallow, absorb);
    float scatter = (1.0 - depth01) * _Scatter;
    float3 waterBase = depthTint + scatter;
    
    // Standard water alpha (used when no heatmap data is present)
    float alphaBase = lerp(_ShallowColor.a, _DeepColor.a, depth01);

    // ---- Refraction ----
    float refrFade = saturate(lerp(1.0, 1.0 - _RefractionDepthFade, depth01));
    float2 distortion = normalWS.xz * _RefractionStrength * refrFade;
    float3 sceneCol = SampleSceneColor(uvScreen + distortion);
    float refrAmount = (1.0 - depth01) * 0.65;
    float3 refracted = lerp(waterBase, sceneCol * waterBase, refrAmount);

    // ---- Foam ----
    float foamShore = 1.0 - saturate(waterDepth / max(0.0001, _FoamSize));
    float2 foamUV = IN.positionWS.xz * _FoamTiling + _FoamSpeed.xy * t;
    float foamNoise = SAMPLE_TEXTURE2D(_FoamNoise, sampler_FoamNoise, foamUV).r;
    float crest = saturate((1.0 - normalWS.y) * 3.0) * _CrestFoam;
    float foam = saturate(foamShore * (foamNoise * 1.2) + crest);
    foam = smoothstep(_FoamCutoff, 1.0, foam);
    float3 withFoam = lerp(refracted, _FoamColor.rgb, foam);

    // ---- Lighting ----
    Light mainLight = GetMainLight();
    float3 L = normalize(mainLight.direction);
    float3 H = normalize(L + viewDir);
    float NdotL = saturate(dot(normalWS, L));
    float NdotH = saturate(dot(normalWS, H));
    float NdotV = saturate(dot(normalWS, viewDir));

    float specPower = lerp(32.0, 512.0, _Smoothness);
    float spec = pow(NdotH, specPower) * (0.04 + 0.96 * pow(1.0 - NdotV, 2.0));
    float fresnel = pow(1.0 - NdotV, _FresnelPower);
    float3 lit = withFoam * (0.35 + 0.65 * NdotL) + spec * _SpecularColor.rgb * mainLight.color * 1.25 + fresnel * mainLight.color * 0.08;

    // ---- Caustics ----
    if (_CausticsStrength > 0.001)
    {
        float c = Caustics(IN.positionWS.xz, t * _CausticsSpeed);
        float shallowMask = (1.0 - depth01) * (1.0 - foam); 
        lit += c * _CausticsStrength * shallowMask * 0.25;
    }

    // ================= REVISED FIX =================
    // 1. Get the Data Presence (Vertex Alpha)
    // If this is the main water plane, IN.color.a will likely be 0.
    float dataPresence = saturate(IN.color.a);
    
    // 2. Calculate Intensity Mask
    float heatmapMask = dataPresence * _HeatmapIntensity;
    float3 heatmapColor = IN.color.rgb;

    // 3. Blend Colors
    // If mask is 0 (no data), we keep the original 'lit' water color.
    float3 tintedLit = lit * lerp(1.0.xxx, heatmapColor, _HeatmapTintStrength) + heatmapColor * (_HeatmapEmission * heatmapMask);
    float3 finalColor = lerp(lit, tintedLit, heatmapMask);

    // 4. FIX: Use Standard Water Alpha as the fallback.
    // Instead of multiplying by dataPresence (which hides the water), we lerp.
    // Target Alpha when Heatmap is Active:
    float heatmapAlphaTarget = alphaBase * _HeatmapAlphaMax;
    
    // Final Alpha: Blends from Standard Water Alpha -> Heatmap Alpha based on mask.
    float finalAlpha = lerp(alphaBase, heatmapAlphaTarget, heatmapMask);
    // ============================================

    // ---- Fog ----
    float fogFactor = ComputeFogFactor(IN.positionCS.z);
    finalColor = MixFog(finalColor, fogFactor);

    return half4(finalColor, finalAlpha);
}
            ENDHLSL
        }
    }
}
