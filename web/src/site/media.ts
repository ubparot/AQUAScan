/** `focus` is an object-position used when the image is cropped to fill a frame. */
type Media = { src: string; width: number; height: number; alt: string; focus?: string }

const site = (name: string, width: number, height: number, alt: string, focus?: string): Media => ({ src: `/media/site/${name}.webp`, width, height, alt, focus })

export const media = {
  heroPoster: { src: '/media/aquascan-hero-poster.jpg', width: 1440, height: 1080, alt: 'AquaScan crossing a pond at dusk' },
  vesselPond: site('vessel-pond', 1448, 1086, 'AquaScan floating on a calm pond at dusk, trees reflected in the water', '50% 45%'),
  boatDusk: site('boat-dusk', 2000, 1394, 'An early AquaScan build floating at the edge of a pond at sunset'),
  boatFountain: site('boat-fountain', 1600, 1155, 'AquaScan on a pond during field testing, with a fountain in the background', '50% 92%'),
  boatPool: site('boat-pool', 916, 688, 'AquaScan floating in a swimming pool during controlled testing'),
  boatRender: site('boat-render', 973, 598, 'CAD rendering of the AquaScan catamaran hull and canopy'),
  boatRenderWinch: site('boat-render-winch', 1431, 1099, 'CAD rendering of the winch and spool mounted between the pontoons'),
  probeShore: site('probe-shore', 2048, 1536, 'The AquaScan probe resting in shallow water at the edge of a pond'),
  probeSand: site('probe-sand', 2000, 1500, 'The AquaScan probe on a sandy shoreline'),
  probeFront: site('probe-front', 1600, 1200, 'Front view of the AquaScan probe showing its four stabilizing fins'),
  probeExploded: site('probe-exploded', 1036, 649, 'Exploded CAD view of the probe: nose cone, component tray, main body and fins'),
  electronics: site('electronics', 1200, 1445, 'AquaScan electronics tray with the controller boards, fuses and battery wiring'),
  controlDrive: site('control-drive', 1800, 1108, 'AquaScan live control dashboard: drive controls and joystick, the mission route on a 3D map, and live battery, depth and signal readouts'),
  controlPlan: site('control-plan', 1800, 1108, 'AquaScan mission planner with saved plans, waypoint list and route length'),
  controlRun: site('control-run', 1800, 1108, 'AquaScan run monitor showing mission progress, next waypoint, ETA and boat mode'),
  controlReview: site('control-review', 1800, 1108, 'AquaScan post-mission review with telemetry packets, route length and sensor range'),
  sensorMaps: site('sensor-maps', 1400, 1615, 'Grid of location-based heat maps for each sensor channel from a pond test'),
  depthProfiles: site('depth-profiles', 1600, 1329, 'Charts of temperature, pH, oxygen, turbidity and other readings plotted against probe depth'),
  turbidityMap: site('turbidity-map', 1314, 1116, 'Turbidity heat map interpolated from GPS-tagged sample points'),
  sealTest: site('seal-test', 1400, 1050, 'An O-ring seal test piece sitting in water during waterproofing trials'),
} satisfies Record<string, Media>

export type { Media }
