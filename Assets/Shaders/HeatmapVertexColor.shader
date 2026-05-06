Shader "AQUAScan/HeatmapVertexColor"
{
    Properties
    {
        _Color("Tint", Color) = (1,1,1,1)
        _AlphaScale("Alpha Scale", Range(0,8)) = 5.5
        _Emission("Emission", Range(0,4)) = 1.15
    }

    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent+20" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Name "HeatmapVertexColor"
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off
            ZTest LEqual

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float4 color : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float4 color : COLOR;
            };

            CBUFFER_START(UnityPerMaterial)
                float4 _Color;
                float _AlphaScale;
                float _Emission;
            CBUFFER_END

            Varyings Vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.color = input.color * _Color;
                return output;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                float alpha = saturate(input.color.a * _AlphaScale);
                float3 color = input.color.rgb * (1.0 + _Emission);
                return half4(color, alpha);
            }
            ENDHLSL
        }
    }
}
