import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './ShipOSPage.css'

type ShipCoordinate = {
  x: number
  y: number
  z: number
}

type ShipVelocityVector = ShipCoordinate

type ShipContactKind = 'body' | 'relay' | 'ship' | 'station' | 'gps' | 'asteroid' | 'radar' | 'signal' | 'waypoint' | 'custom'
type ContactClassFilterId = 'bodies' | 'stations' | 'ships' | 'asteroids' | 'radar' | 'signals' | 'gpsWaypoints' | 'relays'
type ContactIffFilterId = 'owned' | 'friendly' | 'neutral' | 'hostile' | 'unknown'
type ContactDispositionId = 'auto' | 'owned' | ContactIffFilterId
type ContactDispositionOverride = Exclude<ContactDispositionId, 'auto'>
type ContactSortKey = 'distance' | 'name' | 'kind' | 'iff' | 'faction' | 'source' | 'className' | 'status'
type ContactSortDirection = 'asc' | 'desc'
type ContactSortState = {
  key: ContactSortKey
  direction: ContactSortDirection
}
type BodyScaleMode = 'true-scale' | 'tactical'
type MapCameraMode = 'overhead' | 'forward'
type MasterAlarmLevel = 'normal' | 'caution' | 'critical'
type MasterAlarmState = {
  level: MasterAlarmLevel
  reason: string
  triggeredAt: number | null
}
type ShipOsFontFace = 'tech' | 'sans' | 'serif'
type ShipOsDisplayPreferences = {
  fontSize: number
  fontFace: ShipOsFontFace
}

type ShipOsAiModelOption = {
  providerName: string
  modelName: string
  displayName: string
  isDefault: boolean
}

type ShipOsAiResponse = {
  reply: string
  providerName: string
  modelName: string
  createdAt: string
}
type ContactFilterState = {
  classes: Record<ContactClassFilterId, boolean>
  iff: Record<ContactIffFilterId, boolean>
  factions: Record<string, boolean>
}

type ContactFactionOption = {
  id: string
  label: string
  source: string
}

type PlanetaryChartOverride = ShipCoordinate & {
  source: string
  updatedAt: number
  originalName?: string
  radiusMeters?: number
  entityId?: string
  generatorName?: string
  storageName?: string
}

type PlanetaryChartOverrides = Record<string, PlanetaryChartOverride>

type ShipContact = ShipCoordinate & {
  id: string
  name: string
  className: string
  kind: ShipContactKind
  status: string
  color: string
  notes: string
  shortLabel?: string
  rangeMeters?: number
  radiusMeters?: number
  entityId?: string
  generatorName?: string
  storageName?: string
  hasAtmosphere?: boolean
  surfaceGravity?: number
  sourceName?: string
  relationship?: string
  contactSource?: string
  antennaName?: string
  faction?: string
  manualName?: boolean
  manualRecord?: boolean
  telemetryManaged?: boolean
  manualDisposition?: ContactDispositionOverride
  velocityX?: number
  velocityY?: number
  velocityZ?: number
  speed?: number
}

type EncounterMemoryContact = ShipCoordinate & {
  key: string
  id: string
  name: string
  kind: ShipContactKind
  color: string
  classFilter: ContactClassFilterId
  iff: ContactIffFilterId
  factionFilter: string
  firstSeen: number
  lastSeen: number
}

type PersonnelFileSelection = {
  kind: 'crew' | 'passenger'
  id: string
}

type OfficerShipTabId = 'captain' | 'firstOfficer' | 'flight' | 'engineering' | 'medical' | 'security' | 'steward' | 'surveyAid' | 'chronicle' | 'metagame'
type PrimaryShipTabId = OfficerShipTabId | 'telemetry'
type LegacyShipToolId = 'navigation' | 'crew' | 'logs' | 'bank'
type ShipTabId = PrimaryShipTabId | LegacyShipToolId
type WavePriority = 'routine' | 'priority' | 'urgent'
type WaveChannel = 'wave' | 'hail' | 'ship-to-ship' | 'ship-to-shore' | 'docking'
type EchoMailFolder = 'inbox' | 'sent' | 'pending' | 'hails' | 'all'

type Wave = {
  id: string
  direction: 'incoming' | 'outgoing'
  network: string
  from: string
  to: string
  subject: string
  body: string
  createdAt: number
  status: 'received' | 'sent' | 'awaiting-response' | 'responded'
  responseDueAt?: number
  crewTarget?: string
  priority?: WavePriority
  channel?: WaveChannel
  contactId?: string
  contactName?: string
  clearanceStatus?: 'Requested' | 'Granted' | 'Denied' | 'Negotiating'
  feesCredits?: number
}

type WaveDraft = {
  network: string
  to: string
  subject: string
  body: string
  crewTarget: string
  priority: WavePriority
  channel: WaveChannel
  contactId: string
}

type EchoMailThread = {
  key: string
  waves: Wave[]
  latest: Wave
  pendingCount: number
  incomingCount: number
  priority: WavePriority
  channel: WaveChannel
  contactId?: string
  contactName?: string
}

type CrewMember = {
  id: string
  name: string
  role: string
  shift: string
  status: string
  clearance: string
  serviceNumber?: string
  department?: string
  billet?: string
  rateMonthly?: number
  contractStatus?: string
  registryStanding?: string
  quarters?: string
  medicalStatus?: string
  credentials?: string[]
  notes?: string
  hiredAt?: number
  portraitId?: string
}

type CrewFormDraft = {
  portraitId: string
  name: string
  role: string
  department: string
  serviceNumber: string
  billet: string
  rateMonthly: string
  contractStatus: string
  registryStanding: string
  quarters: string
  shift: string
  status: string
  clearance: string
  medicalStatus: string
  credentials: string
  notes: string
}

type CargoItem = {
  id: string
  name: string
  category: string
  quantity: number
  mass: number
  bay: string
}

type JobRecord = {
  id: string
  title: string
  client: string
  route: string
  destination: string
  status: 'Prospect' | 'Booked' | 'Boarding' | 'In Transit' | 'Complete' | 'On Hold'
  payout: number
  departure: string
  due: string
  notes: string
  createdAt: number
}

type PassengerFile = {
  id: string
  jobId: string
  name: string
  manifestId: string
  origin: string
  destination: string
  cabin: string
  fare: number
  status: 'Prospect' | 'Booked' | 'Boarded' | 'In Transit' | 'Delivered' | 'Flagged' | 'Declined'
  clearance: string
  risk: string
  baggageKg: number
  contact: string
  medical: string
  notes: string
  createdAt: number
  portraitId?: string
}

type ShipLog = {
  id: string
  stamp: number
  system: string
  entry: string
}

type ContactImageAttachment = {
  id: string
  contactId: string
  contactName: string
  fileName: string
  caption: string
  dataUrl: string
  width: number
  height: number
  byteSize: number
  createdAt: number
}

type BankEntry = {
  id: string
  date: string
  kind: 'income' | 'expense'
  vendor: string
  category: string
  amount: number
  recurring: boolean
  notes: string
}

type TerrainScanSample = {
  row: number
  column: number
  ahead: number
  lateral: number
  clearance: number
  surfaceDelta: number
}

type TelemetryPacket = {
  protocol?: string
  source?: string
  modVersion?: string
  version?: number
  packetId?: string
  sequence?: number
  ship?: string
  stamp?: string
  x?: number
  y?: number
  z?: number
  velocityX?: number
  velocityY?: number
  velocityZ?: number
  angularVelocityX?: number
  angularVelocityY?: number
  angularVelocityZ?: number
  speed?: number
  mass?: number
  naturalGravity?: number
  surfaceAltitude?: number
  seaLevelAltitude?: number
  verticalSpeed?: number
  horizontalSpeed?: number
  gravityX?: number
  gravityY?: number
  gravityZ?: number
  forwardX?: number
  forwardY?: number
  forwardZ?: number
  upX?: number
  upY?: number
  upZ?: number
  planetCenterX?: number
  planetCenterY?: number
  planetCenterZ?: number
  terrainScanRange?: number
  terrainScanWidth?: number
  terrainScanRows?: number
  terrainScanColumns?: number
  terrainScanSource?: string
  terrainScanStatus?: string
  terrainScan?: TerrainScanSample[]
  dampeners?: boolean
  underControl?: boolean
  batteryPercent?: number
  hydrogenPercent?: number
  oxygenPercent?: number
  jumpPercent?: number
  reactorPercent?: number
  thrustPercent?: number
  cargoPercent?: number
  cargoCurrentVolume?: number
  cargoMaxVolume?: number
  terminalBlockCount?: number
  functionalBlockCount?: number
  nonFunctionalBlockCount?: number
  notWorkingBlockCount?: number
  batteryCount?: number
  gasTankCount?: number
  hydrogenTankCount?: number
  oxygenTankCount?: number
  jumpDriveCount?: number
  reactorCount?: number
  inventoryCount?: number
  thrusterCount?: number
  gyroCount?: number
  connectorCount?: number
  connectedConnectorCount?: number
  landingGearCount?: number
  lockedLandingGearCount?: number
  airVentCount?: number
  pressurizedVentCount?: number
  antennaCount?: number
  weaponCount?: number
  toolCount?: number
  instructionCount?: number
  controller?: string
  grid?: string
  notes?: string
  contacts?: TelemetryContactPacket[]
}

type TelemetrySample = TelemetryPacket & {
  id: string
  receivedAt: number
  importedBy: 'manual' | 'bridge'
}

type NavigationPlanDraft = {
  destinationId: string
  cruiseSpeed: string
  fuelReserve: string
  notes: string
}

type FlightRoutePoint = {
  label: string
  coordinate: ShipCoordinate
  contact?: ShipContact
}

type FlightRoutePlan = {
  id: string
  label: string
  status: JobRecord['status']
  color: string
  points: FlightRoutePoint[]
  pointLabels: string[]
  destinationName: string
  distanceMeters: number
  eta: string
  passengerCount: number
}

type BridgeConfig = {
  endpoint: string
  status: string
  lastAttemptAt?: number
  lastSuccessAt?: number
  lastHealthAt?: number
  autoPoll?: boolean
  pollSeconds?: number
  consecutiveFailures?: number
  packetCount?: number
  latestStamp?: string
  bridgeUptimeSeconds?: number
}

type TelemetryContactPacket = {
  id?: string
  name?: string
  className?: string
  kind?: ShipContactKind | string
  status?: string
  color?: string
  notes?: string
  relationship?: string
  contactSource?: string
  antennaName?: string
  faction?: string
  factionName?: string
  owner?: string
  distanceMeters?: number | string
  velocityX?: number | string
  velocityY?: number | string
  velocityZ?: number | string
  vx?: number | string
  vy?: number | string
  vz?: number | string
  speed?: number | string
  radiusMeters?: number | string
  entityId?: number | string
  generatorName?: string
  storageName?: string
  hasAtmosphere?: boolean | string
  surfaceGravity?: number | string
  x?: number | string
  y?: number | string
  z?: number | string
}

type VelocityTelemetryRow = {
  id: string
  label: string
  kind: string
  source: string
  rangeMeters: number | null
  absoluteSpeed: number | null
  relativeSpeed: number | null
  rangeRate: number | null
  bearingDegrees: number | null
  elevationDegrees: number | null
  vector: ShipVelocityVector | null
  selected: boolean
  contactId: string
}

type BlueprintBlockCategory = 'armor' | 'propulsion' | 'power' | 'cargo' | 'control' | 'weapon' | 'life' | 'utility' | 'interior'
type BlueprintBlockShape = 'cube' | 'slope' | 'corner' | 'thin' | 'truss'
type BlueprintViewPreset = 'shape' | 'actual' | 'category'

type BlueprintBlockFootprint = {
  sizeX: number
  sizeY: number
  sizeZ: number
}

type BlueprintModelBlock = {
  x: number
  y: number
  z: number
  category: BlueprintBlockCategory
  shape?: BlueprintBlockShape
  subtype: string
  forward?: string
  up?: string
  sizeX?: number
  sizeY?: number
  sizeZ?: number
}

type BlueprintBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

type BlueprintSnapshot = {
  id: string
  fileName: string
  name: string
  importedAt: number
  rawSize: number
  gridCount: number
  blockCount: number
  largestGrid: string
  cockpitCount: number
  thrusterCount: number
  gyroCount: number
  cargoCount: number
  batteryCount: number
  reactorCount: number
  jumpDriveCount: number
  connectorCount: number
  renderedBlockCount?: number
  bounds?: BlueprintBounds
  modelBlocks?: BlueprintModelBlock[]
  notes: string
}

const blueprintViewPresetOptions: { id: BlueprintViewPreset; label: string }[] = [
  { id: 'shape', label: 'Shape layer' },
  { id: 'actual', label: 'Actual footprint' },
  { id: 'category', label: 'Category cubes' },
]

type DraftWaypoint = {
  name: string
  className: string
  kind: ShipContactKind
  x: string
  y: string
  z: string
  notes: string
}

type ContactModalDraft = {
  name: string
  className: string
  factionName: string
  notes: string
}

type PlanetaryCalibrationDraft = {
  bodyId: string
  x: string
  y: string
  z: string
  gpsLines: string
}

type BankDraft = {
  date: string
  kind: 'income' | 'expense'
  vendor: string
  category: string
  amount: string
  recurring: boolean
  notes: string
}

type JobDraft = {
  title: string
  client: string
  route: string
  destination: string
  status: JobRecord['status']
  payout: string
  departure: string
  due: string
  notes: string
}

type PassengerDraft = {
  portraitId: string
  jobId: string
  name: string
  manifestId: string
  origin: string
  destination: string
  cabin: string
  fare: string
  status: PassengerFile['status']
  clearance: string
  risk: string
  baggageKg: string
  contact: string
  medical: string
  notes: string
}

type GeneratedPortrait = {
  id: string
  name: string
  skinTone: string
  hairColor: string
  eyeColor: string
  uniformColor: string
  accentColor: string
  hairStyle: 'cropped' | 'swept' | 'long' | 'buzz'
  notes: string
  createdAt: number
}

type PortraitMakerDraft = Omit<GeneratedPortrait, 'id' | 'createdAt'>

type MetagameRecord = {
  id: string
  kind: 'Character' | 'Faction' | 'Location' | 'Mystery' | 'Rumor' | 'Contract' | 'System Note'
  name: string
  visibility: 'Canon' | 'GM-only' | 'Rumor' | 'Not Yet Established'
  status: string
  tags: string[]
  notes: string
  createdAt: number
}

type MetagameDraft = {
  kind: MetagameRecord['kind']
  name: string
  visibility: MetagameRecord['visibility']
  status: string
  tags: string
  notes: string
}

type KnowledgeState = 'DETECTED' | 'OBSERVED' | 'SURVEYED' | 'VERIFIED' | 'DISPUTED' | 'OBSOLETE' | 'DESTROYED'
type ConfidenceState = 'CONFIRMED' | 'PROBABLE' | 'RUMOR' | 'DISPUTED'

type LocationRecord = ShipCoordinate & {
  id: string
  contactId?: string
  name: string
  body: string
  className: string
  knowledgeState: KnowledgeState
  confidence: ConfidenceState
  altitude: string
  gravity: string
  atmosphere: string
  landingSuitability: string
  approachNotes: string
  hazards: string
  previousVisits: string[]
  knownRoutes: string[]
  pilotAnnotations: string
  whyHere: string
  relatedJobIds: string[]
  relatedEntityIds: string[]
  updatedAt: number
}

type DirectoryEntity = {
  id: string
  kind: 'Person' | 'Organization' | 'Ship' | 'Faction'
  name: string
  role: string
  relationship: string
  standing: ConfidenceState
  privacy: 'Public' | 'Shipboard' | 'Sensitive'
  locationIds: string[]
  jobIds: string[]
  notes: string
}

type ShipConfigurationRecord = {
  id: string
  version: string
  date: string
  change: string
  reason: string
  shipyard: string
  engineer: string
  cost: number
  previousVersion?: string
  relatedJobId?: string
  relatedIncidentId?: string
  notes: string
}

type SquawkState = 'OPEN' | 'WATCH' | 'DEFERRED' | 'GROUNDING' | 'CLOSED'

type SquawkRecord = {
  id: string
  system: string
  title: string
  state: SquawkState
  condition: string
  openedAt: string
  inspectionDue: string
  responsible: string
  relatedConfigId?: string
  notes: string
}

type CommitmentRecord = {
  id: string
  person: string
  promise: string
  date: string
  location: string
  timeframe: string
  status: 'Open' | 'Watching' | 'Fulfilled' | 'Deferred'
  notes: string
}

type ChronicleEntry = {
  id: string
  title: string
  stamp: number
  source: string
  status: 'Recorded' | 'Pending' | 'Forecast'
  notes: string
}

type MedicalFacilityRecord = {
  id: string
  name: string
  locationId: string
  access: string
  capabilities: string[]
  travelNote: string
  notes: string
}

type SecurityIncidentRecord = {
  id: string
  title: string
  locationId: string
  confidence: ConfidenceState
  permission: 'Public' | 'Shipboard' | 'Sensitive'
  involved: string[]
  outcome: string
  notes: string
}

type StoresRecord = {
  id: string
  item: string
  quantity: number
  unit: string
  storage: string
  desiredMinimum: number
  purchaseLocation: string
  lastPrice: number
  expiration?: string
  notes: string
}

type PortraitOption = {
  id: string
  label: string
  specialty: string
  sheetUrl: string
  column: number
  row: number
}

type PortraitEntry = {
  id: string
  label: string
  specialty: string
}

type PortraitSheetConfig = {
  label: string
  url: string
  entries: PortraitEntry[]
}

export type ShipOSExperience = 'navigation' | 'console'

type ShipOSPageProps = {
  experience?: ShipOSExperience
  onBack: () => void
  accessToken: string
  isSignedIn: boolean
  canUseRelay: boolean
  accountName: string
  accountMode: string
  onSignIn: () => void
  onSignOut: () => void
}

type ShipOsRemoteState = {
  campaignKey: string
  state: Record<string, unknown>
  revision: number
  updatedBy: string
  updatedAt: string
}

type ShipOsTelemetryPairing = {
  id: string
  campaignKey: string
  label: string
  secret: string
  createdAt: string
}

const shipTabGroups: { id: string; label: string; tabs: { id: PrimaryShipTabId; label: string }[] }[] = [
  {
    id: 'command',
    label: 'Command',
    tabs: [
      { id: 'captain', label: 'Captain' },
      { id: 'firstOfficer', label: 'First Officer' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    tabs: [
      { id: 'flight', label: 'Flight' },
      { id: 'telemetry', label: 'Telemetry' },
      { id: 'engineering', label: 'Engineering' },
      { id: 'security', label: 'Security' },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    tabs: [
      { id: 'medical', label: 'Medical' },
      { id: 'steward', label: 'Stewardship' },
      { id: 'surveyAid', label: 'Survey & Aid' },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    tabs: [
      { id: 'chronicle', label: 'Chronicle' },
      { id: 'metagame', label: 'Metagame' },
    ],
  },
]

const shipName = 'DSV Intrepid'
const captainName = 'Captain Johnathan Hales'
const operatingAccountInitialCredits = 5000000
const holdingJobId = 'job-holding'
const campaignSeedVersionKey = 'shipos-campaign-seed-version'
const campaignSeedVersion = 'intrepid-carthage-europa-run-2026-08-18-v2'
const currentVoyageLabel = 'Ares -> Europa'
const currentShipTime = '~07:30 / Morning Watch'
const currentSoulsAboard = 15
const currentOperationalStatus = 'GREEN / unrestricted operation'
const retiredCrewRecordIds = ['crew-pilot-open', 'crew-cheng-open']
const retiredJobRecordIds = ['job-asterion-helena-transfer', 'job-copper-wake-survey']
const retiredPassengerFileIds = ['pax-alden-reyes', 'pax-iori-mak', 'pax-senna-vale']
const retiredCargoRecordIds = ['cargo-medical', 'cargo-cryo-medical', 'cargo-sera-demo']
const retiredShipConfigurationIds = ['cfg-int-0003-planned']
const retiredSquawkRecordIds = ['squawk-engineering-baseline', 'squawk-emergency-stations']
const asterionOrbitalCoords: ShipCoordinate = { x: -87290, y: -88981, z: -87708 }
const asterionExchangeCoords: ShipCoordinate = { x: -84680, y: -87640, z: -84840 }
const asterionTrafficNetCoords: ShipCoordinate = { x: -88420, y: -87920, z: -87040 }
const oldEarthRelayCoords: ShipCoordinate = { x: -92680, y: -86120, z: -81780 }
const covenantCommsCoords: ShipCoordinate = { x: -80920, y: -91740, z: -92760 }
const marshalVossNetCoords: ShipCoordinate = { x: -88850, y: -84560, z: -91260 }
const passengerExchangeCoords: ShipCoordinate = { x: -86420, y: -90220, z: -86640 }
const copperWakeCoords: ShipCoordinate = { x: -86680, y: -89280, z: -87910 }
const flightGuildCoords: ShipCoordinate = { x: -87640, y: -88620, z: -88240 }

function portraitEntry(id: string, label: string, specialty: string): PortraitEntry {
  return { id, label, specialty }
}

function createPortraitOptions(sheetUrl: string, entries: PortraitEntry[]): PortraitOption[] {
  return entries.map((entry, index) => ({
    ...entry,
    sheetUrl,
    column: index % 4,
    row: Math.floor(index / 4),
  }))
}

const portraitSheetConfigs: PortraitSheetConfig[] = [
  {
    label: 'Shipboard Core',
    url: '/shipos/portrait-sheet.png',
    entries: [
      portraitEntry('portrait-command-red', 'Command Red', 'Captain / XO'),
      portraitEntry('portrait-security-blue', 'Security Blue', 'Security / Tactical'),
      portraitEntry('portrait-nav-slate', 'Nav Slate', 'Navigator / Comms'),
      portraitEntry('portrait-frontier-olive', 'Frontier Olive', 'Pilot / Contractor'),
      portraitEntry('portrait-flight-white', 'Flight White', 'Flight officer'),
      portraitEntry('portrait-engineer-veteran', 'Engineer Veteran', 'Engineering'),
      portraitEntry('portrait-medical-white', 'Medical White', 'Medical / Science'),
      portraitEntry('portrait-dock-amber', 'Dock Amber', 'Steward / Broker'),
      portraitEntry('portrait-admin-green', 'Admin Green', 'Station official'),
      portraitEntry('portrait-crew-olive', 'Crew Olive', 'Deckhand / Passenger'),
      portraitEntry('portrait-signals-rust', 'Signals Rust', 'Signals / Analyst'),
      portraitEntry('portrait-owner-grey', 'Owner Grey', 'Owner / Patron'),
    ],
  },
  {
    label: 'Frontier & Station',
    url: '/shipos/portrait-sheet-02.png',
    entries: [
      portraitEntry('portrait-frontier-watch', 'Frontier Watch', 'Expedition support'),
      portraitEntry('portrait-orbital-tech', 'Orbital Tech', 'Station technician'),
      portraitEntry('portrait-port-security', 'Port Security', 'Security / Watch'),
      portraitEntry('portrait-station-operator', 'Station Operator', 'Control room'),
      portraitEntry('portrait-blackwatch', 'Blackwatch', 'Boarding defense'),
      portraitEntry('portrait-trail-surveyor', 'Trail Surveyor', 'Outer survey'),
      portraitEntry('portrait-family-traveler', 'Family Traveler', 'Civilian passage'),
      portraitEntry('portrait-blue-crewman', 'Blue Crewman', 'Deck operations'),
      portraitEntry('portrait-admin-blonde', 'Admin Clerk', 'Station administration'),
      portraitEntry('portrait-hazard-miner', 'Hazard Miner', 'Industrial crew'),
      portraitEntry('portrait-red-runner', 'Red Runner', 'Courier / Rescue'),
      portraitEntry('portrait-field-analyst', 'Field Analyst', 'Medical / Science'),
    ],
  },
  {
    label: 'Naval & Operations',
    url: '/shipos/portrait-sheet-03.png',
    entries: [
      portraitEntry('portrait-navy-captain', 'Navy Captain', 'Command veteran'),
      portraitEntry('portrait-xo-slate', 'XO Slate', 'Executive officer'),
      portraitEntry('portrait-field-pilot', 'Field Pilot', 'Flight operations'),
      portraitEntry('portrait-trauma-doctor', 'Trauma Doctor', 'Ship medical'),
      portraitEntry('portrait-fusion-engineer', 'Fusion Engineer', 'Engineering'),
      portraitEntry('portrait-boarding-veteran', 'Boarding Veteran', 'Security'),
      portraitEntry('portrait-galley-chief', 'Galley Chief', 'Steward / Cook'),
      portraitEntry('portrait-comms-headset', 'Comms Headset', 'Signals'),
      portraitEntry('portrait-salvage-operator', 'Salvage Operator', 'Recovery'),
      portraitEntry('portrait-dock-inspector', 'Dock Inspector', 'Port services'),
      portraitEntry('portrait-cargo-master', 'Cargo Master', 'Freight'),
      portraitEntry('portrait-yard-chief', 'Yard Chief', 'Shipyard'),
    ],
  },
  {
    label: 'Civilian & Trade',
    url: '/shipos/portrait-sheet-04.png',
    entries: [
      portraitEntry('portrait-hydroponics', 'Hydroponics', 'Agricultural systems'),
      portraitEntry('portrait-civil-engineer', 'Civil Engineer', 'Infrastructure'),
      portraitEntry('portrait-clergy-traveler', 'Clergy Traveler', 'Religious vocation'),
      portraitEntry('portrait-outer-surveyor', 'Outer Surveyor', 'Exploration'),
      portraitEntry('portrait-passenger-red', 'Passenger Red', 'Civilian traveler'),
      portraitEntry('portrait-device-rep', 'Device Rep', 'Medical sales'),
      portraitEntry('portrait-parish-admin', 'Parish Admin', 'Civilian support'),
      portraitEntry('portrait-cargo-broker', 'Cargo Broker', 'Freight business'),
      portraitEntry('portrait-station-teacher', 'Station Teacher', 'Civilian educator'),
      portraitEntry('portrait-repair-foreman', 'Repair Foreman', 'Port labor'),
      portraitEntry('portrait-freight-clerk', 'Freight Clerk', 'Manifest desk'),
      portraitEntry('portrait-commuter', 'Commuter', 'Passenger'),
    ],
  },
  {
    label: 'Medical & Rescue',
    url: '/shipos/portrait-sheet-05.png',
    entries: [
      portraitEntry('portrait-or-surgeon', 'OR Surgeon', 'Surgery'),
      portraitEntry('portrait-flight-nurse', 'Flight Nurse', 'Critical care'),
      portraitEntry('portrait-ambulance-pilot', 'Ambulance Pilot', 'Medical flight'),
      portraitEntry('portrait-rescue-tech', 'Rescue Tech', 'Patient movement'),
      portraitEntry('portrait-cryo-specialist', 'Cryo Specialist', 'Cryogenic medicine'),
      portraitEntry('portrait-toxicology', 'Toxicology', 'Exposure control'),
      portraitEntry('portrait-biomed-engineer', 'Biomed Engineer', 'Medical systems'),
      portraitEntry('portrait-hospital-admin', 'Hospital Admin', 'Clinical authority'),
      portraitEntry('portrait-field-medic', 'Field Medic', 'Emergency medicine'),
      portraitEntry('portrait-quarantine', 'Quarantine', 'Isolation control'),
      portraitEntry('portrait-recovery-coord', 'Recovery Coord', 'Recovery coordinator'),
      portraitEntry('portrait-medical-logistics', 'Medical Logistics', 'Supplies'),
    ],
  },
  {
    label: 'Industrial & Belt',
    url: '/shipos/portrait-sheet-06.png',
    entries: [
      portraitEntry('portrait-asteroid-prospector', 'Prospector', 'Asteroid work'),
      portraitEntry('portrait-ore-pilot', 'Ore Pilot', 'Heavy lift'),
      portraitEntry('portrait-plant-mechanic', 'Plant Mechanic', 'Fusion plant'),
      portraitEntry('portrait-salvage-cutter', 'Salvage Cutter', 'Wreck recovery'),
      portraitEntry('portrait-drone-surveyor', 'Drone Surveyor', 'Survey drones'),
      portraitEntry('portrait-union-rep', 'Union Rep', 'Freight labor'),
      portraitEntry('portrait-station-welder', 'Station Welder', 'Structural work'),
      portraitEntry('portrait-hydrogen-tech', 'Hydrogen Tech', 'Fuel plant'),
      portraitEntry('portrait-roughneck-medic', 'Roughneck Medic', 'Industrial medical'),
      portraitEntry('portrait-belt-courier', 'Belt Courier', 'Courier work'),
      portraitEntry('portrait-hazard-adjuster', 'Hazard Adjuster', 'Claims'),
      portraitEntry('portrait-frontier-mayor', 'Frontier Mayor', 'Settlement admin'),
    ],
  },
  {
    label: 'Authority & Network',
    url: '/shipos/portrait-sheet-07.png',
    entries: [
      portraitEntry('portrait-district-marshal', 'District Marshal', 'Local authority'),
      portraitEntry('portrait-traffic-control', 'Traffic Control', 'Asterion traffic'),
      portraitEntry('portrait-port-inspector', 'Port Inspector', 'Port authority'),
      portraitEntry('portrait-registry-archivist', 'Registry Archivist', 'Covenant records'),
      portraitEntry('portrait-relay-clerk', 'Relay Clerk', 'OldEarth relay'),
      portraitEntry('portrait-guild-dispatch', 'Guild Dispatch', 'Flight guild'),
      portraitEntry('portrait-passenger-agent', 'Passenger Agent', 'Passenger exchange'),
      portraitEntry('portrait-customs-officer', 'Customs Officer', 'Customs'),
      portraitEntry('portrait-copper-wake', 'Copper Wake', 'Hiring hall'),
      portraitEntry('portrait-contract-broker', 'Contract Broker', 'Job market'),
      portraitEntry('portrait-legal-advocate', 'Legal Advocate', 'Contract law'),
      portraitEntry('portrait-systems-admin', 'Systems Admin', 'Orbital systems'),
    ],
  },
]

const portraitOptions: PortraitOption[] = portraitSheetConfigs.flatMap((sheet) => createPortraitOptions(sheet.url, sheet.entries))

const bodyOrbitSpecs: Record<string, { parentId: string | null; guide: string }> = {
  'body-helena': { parentId: null, guide: 'Carthage chart origin' },
  'body-mourning': { parentId: 'body-helena', guide: 'Helena moon track' },
  'body-ares': { parentId: 'body-helena', guide: 'Inner system guide' },
  'body-europa': { parentId: 'body-ares', guide: 'Ares moon track' },
  'body-pelagos': { parentId: 'body-helena', guide: 'Outer system guide' },
  'body-vesper': { parentId: 'body-pelagos', guide: 'Pelagos companion track' },
  'body-triton': { parentId: 'body-helena', guide: 'High-inclination guide' },
  'body-pertam': { parentId: 'body-helena', guide: 'Outer dry-world guide' },
}

const starSystemBodies: ShipContact[] = [
  { id: 'body-helena', entityId: '3868533696819502467', generatorName: 'EarthLike', storageName: 'EarthLike-1779144428d120000', name: 'Helena', className: 'Temperate terrestrial world', kind: 'body', x: 0, y: 0, z: 0, status: 'Asterion primary', color: '#75d69d', radiusMeters: 60000, hasAtmosphere: true, surfaceGravity: 1, notes: 'Principal inhabited world below Asterion Orbital. Around 11 million population, with trade, manufacturing, agriculture, and multiple surface governments. Vanilla Star System EarthLike diameter: 120 km.' },
  { id: 'body-mourning', entityId: '8162427135541297003', generatorName: 'Moon', storageName: 'Moon-1353915701d19000', name: 'Mourning', className: 'Industrial moon', kind: 'body', x: 16384, y: 136384, z: -113615, status: 'Helena mining moon', color: '#c7d6ff', radiusMeters: 9500, hasAtmosphere: false, surfaceGravity: 0.25, notes: 'Industrial and mining moon. Around 600,000 population. Vanilla Star System Moon diameter: 19 km.' },
  { id: 'body-ares', entityId: '7376538848170297803', generatorName: 'Mars', storageName: 'Mars-2044023682d120000', name: 'Ares', className: 'Cold desert world', kind: 'body', x: 1031072, y: 131072, z: 1631072, status: 'Fragmented frontier', color: '#e06d4f', radiusMeters: 60000, hasAtmosphere: true, surfaceGravity: 0.9, notes: 'Cold desert terrestrial world with heavy freight, prospecting, and mercenary traffic. Vanilla Star System Mars diameter: 120 km.' },
  { id: 'body-europa', entityId: '-6999989728267602142', generatorName: 'Europa', storageName: 'Europa-595048092d19000', name: 'Europa', className: 'Hydrogen ice moon', kind: 'body', x: 916384, y: 16384, z: 1616384, status: 'Hydrogen exporter', color: '#f6f2a2', radiusMeters: 9500, hasAtmosphere: true, surfaceGravity: 0.25, notes: 'Major hydrogen exporter with several abandoned installations. Vanilla Star System Europa diameter: 19 km.' },
  { id: 'body-pelagos', entityId: '7227078719122709097', generatorName: 'Alien', storageName: 'Alien-291759539d120000', name: 'Pelagos', className: 'Ocean-heavy world', kind: 'body', x: 131072, y: 131072, z: 5731072, status: 'Orbital piracy risk', color: '#4fb8ff', radiusMeters: 60000, hasAtmosphere: true, surfaceGravity: 1.1, notes: 'Maritime engineering, fisheries, algae production, and recurring piracy around orbital infrastructure. Vanilla Star System Alien diameter: 120 km.' },
  { id: 'body-vesper', entityId: '6409848419840584595', generatorName: 'Titan', storageName: 'Titan-2124704365d19000', name: 'Vesper', className: 'Dense terraformed biosphere', kind: 'body', x: 36384, y: 226384, z: 5796384, status: 'No-authority zones', color: '#9e7cff', radiusMeters: 9500, hasAtmosphere: true, surfaceGravity: 0.25, notes: 'Dense terraformed biosphere with significant areas marked as having no current civil authority. Vanilla Star System Titan diameter: 19 km.' },
  { id: 'body-triton', entityId: '6525117208432977790', generatorName: 'Triton', storageName: 'Triton-12345d80253', name: 'Triton', className: 'Frozen outer world', kind: 'body', x: -284463, y: -2434463, z: 365536, status: 'Sparse mining research', color: '#8ee8ff', radiusMeters: 40126.5, hasAtmosphere: true, surfaceGravity: 1, notes: 'Frozen outer world with sparse mining, research activity, and apparently inactive orbital facilities. Vanilla Star System Triton diameter: 80.253 km.' },
  { id: 'body-pertam', entityId: '6902088205773520807', generatorName: 'Pertam', storageName: 'Pertam-12345d60133', name: 'Pertam', className: 'Hot dry outer world', kind: 'body', x: -3967232, y: -32232, z: -767232, status: 'Old industry', color: '#ffb66e', radiusMeters: 30066.5, hasAtmosphere: true, surfaceGravity: 1.2, notes: 'Hot, dry outer terrestrial world with very old industrial infrastructure and outdated census records. Vanilla Star System Pertam diameter: 60.133 km.' },
]

const bodyCalibrationAliases: Record<string, string[]> = {
  'body-helena': ['helena', 'earthlike', 'earth-like', 'earth like', 'earth'],
  'body-mourning': ['mourning', 'moon', 'luna'],
  'body-ares': ['ares', 'mars'],
  'body-europa': ['europa'],
  'body-pelagos': ['pelagos', 'alien', 'alien planet'],
  'body-vesper': ['vesper', 'titan'],
  'body-triton': ['triton'],
  'body-pertam': ['pertam'],
}

const bodyIdByEntityId = new Map(starSystemBodies.flatMap((body) => body.entityId ? [[body.entityId, body.id] as const] : []))
const bodyIdByStorageName = new Map(starSystemBodies.flatMap((body) => body.storageName ? [[body.storageName.toLowerCase(), body.id] as const] : []))

const relayContacts: ShipContact[] = [
  { id: 'station-asterion', name: 'Asterion Orbital / Ring Three', className: 'Rotating station', kind: 'station', ...asterionOrbitalCoords, status: 'Departure complete', color: '#f6b94d', faction: 'Asterion Orbital Traffic', notes: 'Large inhabited station at the live Asterion coordinate from telemetry. The Intrepid departed Ring Three / Port 17 for the first commercial mission.' },
  { id: 'station-asterion-exchange', name: 'Asterion Commercial Exchange', className: 'Passenger and contract station', kind: 'station', ...asterionExchangeCoords, status: 'Berth services active', color: '#ffb66e', faction: 'Passenger Exchange', notes: 'Second Asterion station in the local cluster. Passenger desks, contract brokerage, contractors, job postings, and civilian traffic route through this exchange rather than the traffic-control ring.' },
  { id: 'relay-asterion-traffic', name: 'Asterion Orbital Traffic', className: 'Port control network', kind: 'relay', ...asterionTrafficNetCoords, status: 'Local traffic linked', color: '#8fb4ff', faction: 'Asterion Orbital Traffic', notes: 'Primary Asterion traffic and berthing network. Placed near Asterion Orbital, offset from the physical station so the network remains independently selectable.' },
  { id: 'relay-oldearth', name: 'OldEarth Relay Network', className: 'Long-haul wave relay', kind: 'relay', ...oldEarthRelayCoords, status: 'Historic traces only', color: '#7de8d2', faction: 'OldEarth Relay Network', notes: 'Used for simulated long-haul waves and old Hales-family traces. The relay access point is near Asterion, not physically on the station.' },
  { id: 'relay-covenant', name: 'Covenant Comms System', className: 'EchoAtlas carrier', kind: 'relay', ...covenantCommsCoords, status: 'Registry recognized', color: '#f1e2c6', faction: 'Covenant Comms System', notes: "The system recognized the Intrepid's old Covenant naval registry even after centuries of isolation. The carrier node is offset from the Asterion station marker for map selection." },
  { id: 'relay-marshal', name: 'Marshal Voss District Net', className: 'Local authority channel', kind: 'relay', ...marshalVossNetCoords, status: 'Frequency approved', color: '#8fb4ff', faction: 'Marshal Voss District Net', notes: 'Marshal Elara Voss approved contact and warned that easy outer-system work often omits important information. Local authority net sits near the Asterion cluster.' },
  { id: 'relay-passenger-exchange', name: 'Passenger Exchange', className: 'Manifest and contract relay', kind: 'relay', ...passengerExchangeCoords, status: 'Manifest desk linked', color: '#ffdf8d', faction: 'Passenger Exchange', notes: 'Brokerage channel for civilian passenger manifests, fare files, berth logistics, and rejected charter inquiries. Offset near the Commercial Exchange.' },
  { id: 'relay-copper-wake', name: 'The Copper Wake', className: 'Hiring hall and bar', kind: 'station', ...copperWakeCoords, status: 'Crew and contracts', color: '#ffb66e', faction: 'Independent Civilian Traffic', notes: 'Station-side bar two levels inward from Port 17, used by pilots, engineers, prospectors, mechanics, navigators, security contractors, and independent captains.' },
  { id: 'relay-flight-guild', name: 'Local Flight Guild', className: 'Recruitment exchange', kind: 'relay', ...flightGuildCoords, status: 'Applicants active', color: '#d68ebd', faction: 'Local Flight Guild', notes: 'Current applicants: Pilot 9, CHENG 6, Doctor 4. Requirements include local accreditations, Fair registry standing, and no unresolved bonded-service disputes.' },
]

const initialCrew: CrewMember[] = [
  { id: 'crew-hales', name: 'Johnathan Hales', role: 'Captain / Owner', shift: 'Command', status: `${currentVoyageLabel}; morning watch; unrestricted command operations.`, clearance: 'Command', serviceNumber: 'INT-COM-001', department: 'Command', billet: 'Commanding Officer / Owner', rateMonthly: 0, contractStatus: 'Owner aboard; personal wealth remains separate from the ship operating account and relief authority.', registryStanding: 'Former Covenant Navy', quarters: 'Deck A Captain Quarters', medicalStatus: 'Fit for duty', credentials: ['Former Covenant Navy', 'Entered service at 14 under waiver', '12 years service', 'Intrepid assigned 4 years', 'Commanding officer 2 years', 'ICC-certified IFF holder'], notes: 'No home port. Origin: Old Earth / Covenant Navy service. The Intrepid operates independently in the Carthage system.', portraitId: 'portrait-owner-grey' },
  { id: 'crew-mara', name: 'Mara Sennett', role: 'First Officer / Executive Officer / Commercial Operations', shift: 'Command', status: 'Running Europa approach planning, manifests, schedules, payroll, procurement, personnel, contracts, and operating accounts.', clearance: 'Commercial Authority', serviceNumber: 'INT-XO-002', department: 'Command', billet: 'Executive / Commercial Officer', rateMonthly: 3000, contractStatus: 'Active crew agreement.', registryStanding: 'Very Good', quarters: 'Private upper cabin', medicalStatus: 'Fit for duty', credentials: ['Commercial operations', 'Finances and contracts', 'Manifests and payroll', 'Procurement and schedules', 'Personnel administration', 'Independent executive authority'], notes: 'Has independent authority in her portfolio and a standing instruction to challenge command decisions when needed.', portraitId: 'portrait-command-red' },
  { id: 'crew-kessa', name: 'Kessa Vale', role: 'Flight Officer / Pilot', shift: 'Flight', status: 'Owns flight safety and the Ares-to-Europa approach profile.', clearance: 'Flight Authority', serviceNumber: 'INT-FLT-003', department: 'Flight', billet: 'Primary Flight Officer', rateMonthly: 2500, contractStatus: 'Active crew agreement.', registryStanding: 'Excellent', quarters: 'Deck A private cabin', medicalStatus: 'Fit for duty', credentials: ['Commercial First Class pilot', 'Atmospheric heavy', 'Orbital heavy', 'Interplanetary', 'FTL watch certification', 'Approximately 9 years professional flight'], notes: 'Standing command permission: low and fast when Flight judges it safe. Flight authority controls maneuver safety.', portraitId: 'portrait-flight-white' },
  { id: 'crew-selene', name: 'Dr. Selene Vard', role: "Medical Officer / Ship's Doctor", shift: 'Medical', status: 'Medical suite fully refitted with independent emergency feeds, expanded surgical capability, and reserve systems.', clearance: 'Medical Authority', serviceNumber: 'INT-MED-004', department: 'Medical', billet: "Ship's Doctor / Crew Wellness Adviser", rateMonthly: 2500, contractStatus: 'Active crew agreement; continuing education funded.', registryStanding: 'Very Good', quarters: 'Doctor quarters aft of bridge', medicalStatus: 'Fit for duty', credentials: ['Emergency Medicine', 'Trauma Surgery', 'Shipboard medical certification', 'AutoSurgDoc operation', 'Expanded surgical capability', 'Crew wellness'], notes: 'Protected medical information remains outside ABIGAIL access unless specifically authorized. Medical authority can abort unsafe transfers.', portraitId: 'portrait-medical-white' },
  { id: 'crew-toren', name: 'Toren Vask', role: 'Chief Engineer / Tactical Secondary', shift: 'Engineering', status: 'Post-refit proving period active; no grounding faults and approximately 50 operating hours requested for confidence.', clearance: 'Engineering Authority', serviceNumber: 'INT-ENG-005', department: 'Engineering', billet: 'Chief Engineer / Tactical Secondary', rateMonthly: 2500, contractStatus: 'Active crew agreement.', registryStanding: 'Excellent', quarters: 'CHENG berth in Engineering', medicalStatus: 'Fit for duty', credentials: ['Chief Engineer Class One', '22 years ship engineering', 'Fusion systems', 'FTL support', 'Atmospheric propulsion', 'Naval-surplus power distribution', 'Weapons power systems'], notes: 'Engineering authority owns the plant. Current discrepancies are observational and do not restrict operations. Assessment: decades of structural life remain.', portraitId: 'portrait-engineer-veteran' },
  { id: 'crew-garran', name: 'Garran Vex', role: 'Security Officer', shift: 'Security', status: 'Security watch active for a fully occupied passenger deck and unrestricted ship operations.', clearance: 'Security', serviceNumber: 'INT-SEC-006', department: 'Security', billet: 'Security Officer / Boarding Defense', rateMonthly: 2500, contractStatus: 'Active crew agreement.', registryStanding: 'Good', quarters: 'Security berth', medicalStatus: 'Fit for duty', credentials: ['Former special operations', 'Private security', 'Heavy weapons', 'Boarding defense', 'Nonlethal restraint', 'Combat lifesaver'], notes: '6 ft 7 in and approximately 385 pounds lean. Escalation doctrine: presence, de-escalation, restraint, controlled force, then weapons.', portraitId: 'portrait-security-blue' },
  { id: 'crew-luca', name: 'Luca Bern', role: 'Steward / Cook', shift: 'Galley', status: 'Supporting 15 souls, two galleys, six occupied passenger cabins, stores, meals, and passenger services.', clearance: 'Passenger Services', serviceNumber: 'INT-STW-007', department: 'Hospitality', billet: 'Steward / Cook', rateMonthly: 2500, contractStatus: 'Active crew agreement with broad pantry discretion.', registryStanding: 'Very Good', quarters: 'Crew cabin', medicalStatus: 'Fit for duty', credentials: ['18 years shipboard experience', 'Merchant steward', 'Shipboard cook', 'Passenger service', 'Stores management', 'Food safety', 'Emergency rationing'], notes: 'Maintains a modular hydroponic herb wall with Iria Vale. Becomes sing-songy only while actively cooking.', portraitId: 'portrait-dock-amber' },
  { id: 'crew-renn', name: 'Renn Harrow', role: 'Survey & Field Liaison', shift: 'Survey / Flight Support', status: 'Active crew; mapping Europa infrastructure, local organizations, needs, resources, and onward opportunities.', clearance: 'Survey / Liaison', serviceNumber: 'INT-SRV-008', department: 'Survey', billet: 'Survey & Field Liaison', rateMonthly: 2500, contractStatus: 'Active crew agreement; 90-day provisional Ares Civil Continuity liaison credential.', registryStanding: 'Fair', quarters: 'Private Deck A crew cabin', medicalStatus: 'Fit for duty', credentials: ['Field survey', 'Infrastructure assessment', 'Local contacts', 'Resource mapping', 'Sensor reconnaissance', 'ShipOS field data'], notes: 'Former passenger. May recommend aid but cannot promise it. Secondary sensor and reconnaissance work remains under Flight authority.', portraitId: 'portrait-outer-surveyor' },
]

const initialCargo: CargoItem[] = [
  { id: 'cargo-ice', name: 'Ice', category: 'Resource', quantity: 18400, mass: 18400, bay: 'A1' },
  { id: 'cargo-components', name: 'Spare Naval Equipment', category: 'Refit stores', quantity: 320, mass: 9600, bay: 'Standardized Mission Bay' },
  { id: 'cargo-passenger', name: 'Passenger Provisions', category: 'Passenger service', quantity: 15, mass: 1260, bay: 'Upper cabins / galley stores' },
  { id: 'cargo-iria-case', name: 'Iria Vale Equipment Case', category: 'Passenger declared cargo', quantity: 1, mass: 0, bay: 'Passenger baggage hold' },
]

const initialJobs: JobRecord[] = [
  { id: holdingJobId, title: 'Open Passenger Holding', client: 'Shipboard manifest', route: 'Unassigned / intake pending', destination: 'TBD', status: 'On Hold', payout: 0, departure: currentIsoDate(), due: currentIsoDate(), notes: 'Passenger files waiting for a contract packet or destination assignment.', createdAt: Date.now() - 720000 },
  { id: 'job-ares-europa-pelagos-passage', title: 'Ares to Europa and Pelagos Passenger Run', client: 'Seven-passenger consolidated manifest', route: 'Ares -> Europa (three-day layover) -> Pelagos', destination: 'Pelagos via Europa', status: 'In Transit', payout: 0, departure: currentIsoDate(), due: currentIsoDate(), notes: 'Current paid voyage. Deliver Dr. Amiel Sato at Europa, complete a three-day post-refit layover, then continue to Pelagos. Six passenger cabins are occupied by seven passengers. No emergency or aid mission is currently accepted.', createdAt: Date.now() - 700000 },
  { id: 'job-helena-ares-medical-transfer', title: 'Helena to Ares Critical Medical Transport', client: 'Helena Medical Authority', route: 'Helena surface facility -> DSV Intrepid -> Ares surface facility', destination: 'Ares surface', status: 'Complete', payout: 118000, departure: currentIsoDate(), due: currentIsoDate(), notes: 'First paid professional mission completed successfully. Two critical-care patients and one accompanying physician were delivered; fuel reimbursement was included.', createdAt: Date.now() - 640000 },
  { id: 'job-first-run-civilian-passengers', title: 'First Run Civilian Passenger Manifest', client: 'Passenger Exchange / Asterion berthing desk', route: 'Asterion Orbital / Helena route -> Ares', destination: 'Ares', status: 'Complete', payout: 0, departure: currentIsoDate(), due: currentIsoDate(), notes: 'Historic first-run civilian manifest completed at Ares. Renn Harrow subsequently joined the crew.', createdAt: Date.now() - 560000 },
  { id: 'job-relay-e17-maintenance', title: 'Relay E-17 Maintenance', client: 'Europa contract channel', route: 'Europa local space -> Relay E-17', destination: 'Relay E-17', status: 'Prospect', payout: 0, departure: currentIsoDate(), due: currentIsoDate(), notes: 'Overdue maintenance posting is of interest only. It has NOT been accepted and carries no ship commitment.', createdAt: Date.now() - 180000 },
  { id: 'job-rejected-passenger-inquiries', title: 'Rejected Passenger Inquiries', client: 'Security / Passenger Exchange', route: 'Asterion Orbital intake review', destination: 'Declined', status: 'On Hold', payout: 0, departure: currentIsoDate(), due: currentIsoDate(), notes: 'Polite declines retained for continuity, future callbacks, or reputation tracking.', createdAt: Date.now() - 420000 },
]

const initialPassengerFiles: PassengerFile[] = [
  { id: 'pax-iria-vale', jobId: 'job-ares-europa-pelagos-passage', name: 'Iria Vale', manifestId: 'PAX-EP-001', origin: 'Ares', destination: 'Continued passage under 30-day agreement', cabin: 'Passenger Cabin 1', fare: 0, status: 'In Transit', clearance: 'Contract specialist', risk: 'Low', baggageKg: 0, contact: 'Mara Sennett', medical: 'No active flag', notes: 'Hydroponics specialist. Receives fare reduction for formal shipboard work and maintains the modular herb wall with Luca.', createdAt: Date.now() - 610000, portraitId: 'portrait-hydroponics' },
  { id: 'pax-derrin-sol', jobId: 'job-ares-europa-pelagos-passage', name: 'Derrin Sol', manifestId: 'PAX-EP-002', origin: 'Ares', destination: 'Pelagos', cabin: 'Passenger Cabin 2', fare: 0, status: 'In Transit', clearance: 'Registry Excellent', risk: 'Low', baggageKg: 0, contact: 'Passenger manifest', medical: 'No active flag', notes: 'Civil and marine infrastructure engineer traveling onward to Pelagos.', createdAt: Date.now() - 600000, portraitId: 'portrait-civil-engineer' },
  { id: 'pax-amiel-sato', jobId: 'job-ares-europa-pelagos-passage', name: 'Dr. Amiel Sato', manifestId: 'PAX-EP-003', origin: 'Ares', destination: 'Europa', cabin: 'Passenger Cabin 3', fare: 0, status: 'In Transit', clearance: 'Professional credential', risk: 'Low', baggageKg: 0, contact: 'Passenger manifest', medical: 'No active flag', notes: 'Cryogenic engineer specializing in hydrogen storage. Primary Europa delivery.', createdAt: Date.now() - 500000, portraitId: 'portrait-cryo-specialist' },
  { id: 'pax-talia-or', jobId: 'job-ares-europa-pelagos-passage', name: 'Dr. Talia Or', manifestId: 'PAX-EP-004', origin: 'Ares', destination: 'Pelagos', cabin: 'Passenger Cabin 4', fare: 0, status: 'In Transit', clearance: 'Professional credential', risk: 'Low', baggageKg: 0, contact: 'Passenger manifest', medical: 'Public health professional', notes: 'Public-health epidemiologist traveling to investigate respiratory illness on a Pelagos platform.', createdAt: Date.now() - 490000, portraitId: 'portrait-field-analyst' },
  { id: 'pax-elias-marr', jobId: 'job-ares-europa-pelagos-passage', name: 'Elias Marr', manifestId: 'PAX-EP-005', origin: 'Ares', destination: 'Pelagos', cabin: 'Passenger Cabin 5 with Juno Marr', fare: 0, status: 'In Transit', clearance: 'Civilian relocation', risk: 'Low', baggageKg: 0, contact: 'Passenger manifest', medical: 'No active flag', notes: 'Marine structural engineer relocating to Pelagos with Juno Marr.', createdAt: Date.now() - 480000, portraitId: 'portrait-repair-foreman' },
  { id: 'pax-juno-marr', jobId: 'job-ares-europa-pelagos-passage', name: 'Juno Marr', manifestId: 'PAX-EP-006', origin: 'Ares', destination: 'Pelagos', cabin: 'Passenger Cabin 5 with Elias Marr', fare: 0, status: 'In Transit', clearance: 'Civilian relocation', risk: 'Low', baggageKg: 0, contact: 'Passenger manifest', medical: 'No active flag', notes: 'History and literature teacher relocating to Pelagos with Elias Marr.', createdAt: Date.now() - 470000, portraitId: 'portrait-station-teacher' },
  { id: 'pax-nadia-kess', jobId: 'job-ares-europa-pelagos-passage', name: 'Nadia Kess', manifestId: 'PAX-EP-007', origin: 'Ares', destination: 'Pelagos', cabin: 'Passenger Cabin 6', fare: 0, status: 'In Transit', clearance: 'Paid passenger', risk: 'Low', baggageKg: 0, contact: 'Passenger manifest', medical: 'No active flag', notes: 'Age 34. Investigative journalist and documentarian with 11 years experience. Paid Ares-to-Pelagos passage. Interview and recording boundaries are explicit; private time with Captain Hales is off the record unless agreed otherwise.', createdAt: Date.now() - 460000, portraitId: 'portrait-comms-headset' },
  { id: 'pax-calen-rusk', jobId: 'job-first-run-civilian-passengers', name: 'Mother Calen Rusk', manifestId: 'PAX-FR-003', origin: 'Asterion Orbital', destination: 'Ares', cabin: 'Released', fare: 0, status: 'Delivered', clearance: 'Registry Very Good', risk: 'Low', baggageKg: 0, contact: 'Parish consortium', medical: 'No flag established', notes: 'Historic first-run passenger delivered at Ares.', createdAt: Date.now() - 590000, portraitId: 'portrait-clergy-traveler' },
  { id: 'pax-renn-harrow', jobId: 'job-first-run-civilian-passengers', name: 'Renn Harrow', manifestId: 'PAX-FR-004', origin: 'Asterion Orbital', destination: 'Ares', cabin: 'Converted to crew quarters', fare: 0, status: 'Delivered', clearance: 'Now crew', risk: 'Low', baggageKg: 0, contact: 'Mara Sennett', medical: 'Transferred to crew record', notes: 'Historic passenger file closed when Renn joined the crew as Survey & Field Liaison.', createdAt: Date.now() - 580000, portraitId: 'portrait-outer-surveyor' },
  { id: 'pax-lysa-coren', jobId: 'job-first-run-civilian-passengers', name: 'Lysa Coren', manifestId: 'PAX-FR-005', origin: 'Helena', destination: 'Ares', cabin: 'Released', fare: 0, status: 'Delivered', clearance: 'Clean civilian', risk: 'Low', baggageKg: 0, contact: 'Passenger Exchange', medical: 'No flag established', notes: 'Historic first-run passenger delivered at Ares.', createdAt: Date.now() - 570000, portraitId: 'portrait-passenger-red' },
  { id: 'pax-tomas-coren', jobId: 'job-first-run-civilian-passengers', name: 'Tomas Coren', manifestId: 'PAX-FR-006', origin: 'Helena', destination: 'Ares', cabin: 'Released', fare: 0, status: 'Delivered', clearance: 'Clean civilian minor', risk: 'Low', baggageKg: 0, contact: 'Lysa Coren', medical: 'No flag established', notes: 'Historic first-run passenger delivered at Ares. Proposed the Ship Chronicle milestone system.', createdAt: Date.now() - 560000, portraitId: 'portrait-family-traveler' },
  { id: 'pax-sera-dain', jobId: 'job-first-run-civilian-passengers', name: 'Sera Dain', manifestId: 'PAX-FR-007', origin: 'Asterion Orbital', destination: 'Ares', cabin: 'Released', fare: 0, status: 'Delivered', clearance: 'Registry Excellent', risk: 'Low', baggageKg: 0, contact: 'Medical-device supplier channel', medical: 'No personal flag', notes: 'Historic first-run passenger delivered at Ares.', createdAt: Date.now() - 550000, portraitId: 'portrait-device-rep' },
  { id: 'pax-medical-patient-1', jobId: 'job-helena-ares-medical-transfer', name: 'Critical Patient 1', manifestId: 'MED-FR-001', origin: 'Helena surface facility', destination: 'Ares surface facility', cabin: 'Released to receiving care', fare: 0, status: 'Delivered', clearance: 'Protected medical file', risk: 'Resolved transfer', baggageKg: 0, contact: 'Helena Medical Authority', medical: 'Protected record', notes: 'Historic critical-care transfer completed successfully.', createdAt: Date.now() - 540000, portraitId: 'portrait-flight-nurse' },
  { id: 'pax-medical-patient-2', jobId: 'job-helena-ares-medical-transfer', name: 'Critical Patient 2', manifestId: 'MED-FR-002', origin: 'Helena surface facility', destination: 'Ares surface facility', cabin: 'Released to receiving care', fare: 0, status: 'Delivered', clearance: 'Protected medical file', risk: 'Resolved transfer', baggageKg: 0, contact: 'Helena Medical Authority', medical: 'Protected record', notes: 'Historic critical-care transfer completed successfully.', createdAt: Date.now() - 530000, portraitId: 'portrait-toxicology' },
  { id: 'pax-accompanying-physician', jobId: 'job-helena-ares-medical-transfer', name: 'Accompanying Physician', manifestId: 'MED-FR-003', origin: 'Helena surface facility', destination: 'Ares surface facility', cabin: 'Released', fare: 0, status: 'Delivered', clearance: 'Clinical credential', risk: 'Low', baggageKg: 0, contact: 'Helena Medical Authority', medical: 'Not applicable', notes: 'Accompanied both patients through successful delivery.', createdAt: Date.now() - 520000, portraitId: 'portrait-or-surgeon' },
  { id: 'pax-vale-orlan', jobId: 'job-rejected-passenger-inquiries', name: 'Vale Orlan', manifestId: 'REJ-FR-001', origin: 'Asterion Orbital', destination: 'Undisclosed outer-system commercial business', cabin: 'Declined', fare: 0, status: 'Declined', clearance: 'Insufficient disclosure', risk: 'High', baggageKg: 0, contact: 'Commercial broker inquiry', medical: 'Not applicable', notes: 'Wanted to charter all six cabins for himself and unnamed associates while refusing to disclose destination beyond vague outer-system commercial business. Declined politely.', createdAt: Date.now() - 510000, portraitId: 'portrait-cargo-broker' },
  { id: 'pax-joren-kael', jobId: 'job-rejected-passenger-inquiries', name: 'Joren Kael', manifestId: 'REJ-FR-002', origin: 'Asterion Orbital', destination: 'First run request declined', cabin: 'Declined', fare: 0, status: 'Declined', clearance: 'Good registry standing; weapon access not approved', risk: 'Medium', baggageKg: 0, contact: 'Former security contractor', medical: 'Not applicable', notes: 'Declared two secured weapons cases and requested permission for personal sidearm access aboard. Declined politely for the first run; could reappear later.', createdAt: Date.now() - 500000, portraitId: 'portrait-boarding-veteran' },
]

const initialMetagameRecords: MetagameRecord[] = [
  { id: 'meta-carthage-isolation', kind: 'Mystery', name: 'Carthage Isolation Gap', visibility: 'GM-only', status: 'Active campaign mystery', tags: ['Carthage', '583 years', 'telemetry'], notes: 'Carthage remained separated from meaningful Covenant civilization for roughly 583 years. The reason remains behind-the-scenes canon until discovered in play.', createdAt: Date.now() - 650000 },
  { id: 'meta-faction-dsv-intrepid', kind: 'Faction', name: 'DSV Intrepid', visibility: 'Canon', status: currentOperationalStatus, tags: ['Intrepid', 'owned grid', 'crew', 'Carthage'], notes: 'Independent former Covenant naval vessel. Current voyage Ares to Europa with 15 souls aboard, no formally designated home port, and no emergency or aid mission accepted.', createdAt: Date.now() - 635000 },
  { id: 'meta-hales-archive-trace', kind: 'Faction', name: 'Hales Family Archive Trace', visibility: 'Canon', status: 'Known locally through old trade records', tags: ['Old Earth', 'wealth', 'archives'], notes: 'The Hales name appears in Carthage trade and investment archives despite the isolation. Local interpretation: money so old that nobody remembers where it began.', createdAt: Date.now() - 620000 },
  { id: 'meta-faction-asterion-traffic', kind: 'Faction', name: 'Asterion Orbital Traffic', visibility: 'Canon', status: 'Primary port and traffic authority', tags: ['Asterion', 'Helena', 'port authority'], notes: 'Traffic and docking authority that recognized Intrepid registry at Ring Three / Port 17.', createdAt: Date.now() - 615000 },
  { id: 'meta-faction-helena-medical', kind: 'Faction', name: 'Helena Medical Authority', visibility: 'Canon', status: 'First paid contract completed', tags: ['Helena', 'medical', 'contract'], notes: 'Origin authority for the successfully completed Helena-to-Ares critical-care transport.', createdAt: Date.now() - 610000 },
  { id: 'meta-faction-passenger-exchange', kind: 'Faction', name: 'Passenger Exchange', visibility: 'Canon', status: 'Passenger and contract brokerage channel', tags: ['Asterion', 'passengers', 'contracts'], notes: 'Source of first-run passenger manifests, charter inquiries, and berth logistics.', createdAt: Date.now() - 605000 },
  { id: 'meta-faction-covenant-comms', kind: 'Faction', name: 'Covenant Comms System', visibility: 'Canon', status: 'Registry-recognized long-haul network', tags: ['Covenant', 'relay', 'registry'], notes: 'Long-haul comms system that recognized the old Covenant naval registry format.', createdAt: Date.now() - 600000 },
  { id: 'meta-faction-oldearth-relay', kind: 'Faction', name: 'OldEarth Relay Network', visibility: 'Canon', status: 'Historic traces only', tags: ['Old Earth', 'relay', 'Hales'], notes: 'Old communications network used for simulated long-haul waves and archive traces.', createdAt: Date.now() - 595000 },
  { id: 'meta-faction-marshal-voss', kind: 'Faction', name: 'Marshal Voss District Net', visibility: 'Canon', status: 'Approved local authority channel', tags: ['Asterion', 'law', 'traffic'], notes: 'Local law/authority frequency approved by Marshal Elara Voss.', createdAt: Date.now() - 592000 },
  { id: 'meta-faction-flight-guild', kind: 'Faction', name: 'Local Flight Guild', visibility: 'Canon', status: 'Recruitment and credential exchange', tags: ['crew', 'hiring', 'flight'], notes: 'Local recruitment and credential channel for pilots, engineers, doctors, and other licensed ship personnel.', createdAt: Date.now() - 588000 },
  { id: 'meta-faction-independent-civilian', kind: 'Faction', name: 'Independent Civilian Traffic', visibility: 'Canon', status: 'Loose civilian and commercial contacts', tags: ['civilian', 'merchant', 'neutral'], notes: 'Default faction bucket for independent ships, bars, contractors, and unaligned commercial traffic.', createdAt: Date.now() - 584000 },
  { id: 'meta-location-asterion-cluster', kind: 'Location', name: 'Asterion Orbital Cluster', visibility: 'Canon', status: 'Anchored to live telemetry coordinate', tags: ['Asterion', 'Helena orbit', 'relay cluster'], notes: 'Canon Asterion lore contacts are anchored around GPS:-87290:-88981:-87708. Physical stations occupy the center of the cluster; relay and administrative networks are nearby offset contacts so they remain distinct from the station grids on the map.', createdAt: Date.now() - 582000 },
  { id: 'meta-internal-dampening', kind: 'System Note', name: 'Internal Dampening Modernization', visibility: 'Canon', status: 'COMPLETED / CERTIFICATION PASS', tags: ['Intrepid', 'medical', 'FTL', 'Meridian'], notes: 'Localized high-resolution dampening now protects Medical, the passenger deck, bridge, and crew accommodations. Live simulated controller and node failures passed.', createdAt: Date.now() - 590000 },
  { id: 'meta-mission-bay', kind: 'Location', name: 'Large Aft Mission Bay', visibility: 'Canon', status: 'Unassigned / utility-ready', tags: ['Intrepid', 'future build', 'ship map'], notes: 'Deliberately unassigned. Meridian installed standardized power, data, atmosphere, water, waste, cooling, and modular equipment hardpoints so future conversion needs no major structural opening.', createdAt: Date.now() - 560000 },
  { id: 'meta-ares-meridian-refit', kind: 'System Note', name: 'Ares Meridian Civilian Refit', visibility: 'Canon', status: 'Completed for 1,981,440 credits', tags: ['Intrepid', 'Ares', 'refit', 'Meridian'], notes: 'Completed under the 2,000,000 credit authorization ceiling. Dampening, FTL isolation, atmospheric actuators, coolant monitoring, distributed Engineering, Medical power, passenger safety, Mission Bay utilities, sensors, and ABIGAIL were modernized.', createdAt: Date.now() - 220000 },
  { id: 'meta-historic-port-spine', kind: 'System Note', name: 'Historic Port-Spine Combat Scar', visibility: 'Canon', status: 'HISTORIC DAMAGE - PRESERVED', tags: ['Intrepid', 'historic damage', 'command'], notes: 'Internal structure, armor backing, and pressure structure are restored to full specification. The reinforced exterior scar remains intentionally visible opposite the former communications sleeping cubby.', createdAt: Date.now() - 210000 },
  { id: 'meta-abigail-mk7', kind: 'System Note', name: 'ABIGAIL Mk VII', visibility: 'Canon', status: 'ONLINE / SUPERVISED OPERATIONAL', tags: ['Intrepid', 'ShipOS', 'AI', 'ABIGAIL'], notes: 'Integrates navigation, sensors, communications, environment, engineering telemetry, maintenance, inventory, manifests, and public information. Cannot fire or authorize weapons, initiate FTL, override Flight or Engineering safeties, defeat FTL isolation, or access protected Medical data without authorization.', createdAt: Date.now() - 200000 },
  { id: 'meta-relief-authority', kind: 'Faction', name: 'Carthage Provisional Relief Authority', visibility: 'Canon', status: 'Funded / no deployments / no commitments', tags: ['Carthage', 'relief', 'Edicarus Hales'], notes: '10,000,000 credits held entirely separate from Intrepid operating funds. Forty-three prospective volunteers and three private vessel owners are standing by. Doctrine: ask, verify, use local capability first, help when appropriate, and do nothing when appropriate.', createdAt: Date.now() - 190000 },
  { id: 'meta-relay-e17', kind: 'Contract', name: 'Relay E-17 Maintenance', visibility: 'Canon', status: 'Prospect - NOT ACCEPTED', tags: ['Europa', 'relay', 'contract'], notes: 'Automated navigation relay maintenance crew is overdue. The posting remains interesting but creates no current obligation.', createdAt: Date.now() - 180000 },
  { id: 'meta-echo-rumor-network', kind: 'Rumor', name: 'Echo of the System', visibility: 'GM-only', status: 'Future simulation idea', tags: ['rumors', 'reputation', 'network'], notes: 'Major Intrepid actions could propagate through Carthage as facts, local versions, system-wide rumors, and propaganda versions.', createdAt: Date.now() - 530000 },
]

const initialLocationRecords: LocationRecord[] = [
  { id: 'loc-body-helena', contactId: 'body-helena', name: 'Helena', body: 'Helena', className: 'Primary inhabited world', knowledgeState: 'VERIFIED', confidence: 'CONFIRMED', x: 0, y: 0, z: 0, altitude: 'Planetary datum', gravity: 'Planetary gravity well', atmosphere: 'Breathable / inhabited', landingSuitability: 'Known surface facilities; use local traffic clearance.', approachNotes: 'Asterion orbital control and surface medical traffic were both cooperative during the first mission.', hazards: 'Industrial zones and regional surface authority boundaries still require local confirmation.', previousVisits: ['Atmospheric insertion and medical pickup completed.'], knownRoutes: ['Asterion Orbital -> Helena medical facility', 'Helena -> Ares non-FTL transfer'], pilotAnnotations: 'Repeat Approach: direct medical pickup worked; preserve patient-safe acceleration and avoid rushed east-side terrain profiles until mapped.', whyHere: 'First commercial mission: embarked two critical-care patients and an accompanying physician for Ares.', relatedJobIds: ['job-helena-ares-medical-transfer'], relatedEntityIds: ['org-helena-medical-authority'], updatedAt: Date.now() - 120000 },
  { id: 'loc-station-asterion', contactId: 'station-asterion', name: 'Asterion Orbital / Ring Three Port 17', body: 'Helena orbit', className: 'Port / traffic control', knowledgeState: 'VERIFIED', confidence: 'CONFIRMED', ...asterionOrbitalCoords, altitude: 'Orbital station', gravity: 'Station rotation / local artificial gravity', atmosphere: 'Pressurized port', landingSuitability: 'Docking berth confirmed for Intrepid registry.', approachNotes: 'Weapons safed while docked. Ring Three / Port 17 recognized old Covenant naval registry. Canon anchor coordinate matches the observed SB-2009 Asterion Orbital telemetry contact.', hazards: 'Customs, berth fees, old-money attention, and dense local traffic around the Asterion station pair.', previousVisits: ['Arrival and crew hiring complete.', 'Departed for Helena pickup.'], knownRoutes: ['Carthage entry vector -> Asterion', 'Asterion -> Helena', 'Asterion -> Ares', 'Asterion Orbital -> Asterion Commercial Exchange'], pilotAnnotations: 'Good baseline port. Preserve departure clearance logs for repeat outbound profiles. Expect relay markers nearby but not co-located with the station grid.', whyHere: 'Initial Carthage arrival, crew hiring, medical refit, passenger intake, and first contract setup.', relatedJobIds: ['job-first-run-civilian-passengers', 'job-helena-ares-medical-transfer'], relatedEntityIds: ['org-asterion-traffic', 'org-passenger-exchange', 'org-covenant-comms', 'org-oldearth-relay'], updatedAt: Date.now() - 180000 },
  { id: 'loc-station-asterion-exchange', contactId: 'station-asterion-exchange', name: 'Asterion Commercial Exchange', body: 'Helena orbit / Asterion cluster', className: 'Passenger and contract station', knowledgeState: 'VERIFIED', confidence: 'CONFIRMED', ...asterionExchangeCoords, altitude: 'Orbital station', gravity: 'Station rotation / local artificial gravity', atmosphere: 'Pressurized commercial concourse', landingSuitability: 'Commercial docking and passenger transfer hub; exact berth assignment pending live clearance.', approachNotes: 'Separate station from Asterion Orbital. Use this marker for Passenger Exchange, contract brokerage, and non-traffic civilian services.', hazards: 'Brokerage disputes, customs checks, passenger security screening, and crowded approach lanes.', previousVisits: ['Passenger manifest and contractor channels established through Asterion services.'], knownRoutes: ['Asterion Commercial Exchange -> Asterion Orbital', 'Asterion Commercial Exchange -> Helena', 'Asterion Commercial Exchange -> Ares'], pilotAnnotations: 'Treat as a nearby but separate Asterion station. Do not stack relay network markers directly on this grid.', whyHere: 'Civilian passenger files, job brokerage, rejected charter inquiries, and commercial refit coordination.', relatedJobIds: ['job-first-run-civilian-passengers', 'job-rejected-passenger-inquiries'], relatedEntityIds: ['org-passenger-exchange', 'org-flight-guild', 'org-independent-civilian'], updatedAt: Date.now() - 170000 },
  { id: 'loc-helena-medical-transfer', name: 'Helena Medical Transfer Facility', body: 'Helena', className: 'Surface medical pickup site', knowledgeState: 'OBSERVED', confidence: 'CONFIRMED', x: 18000, y: -3200, z: 9400, altitude: 'Surface facility', gravity: 'Helena gravity', atmosphere: 'Breathable / hospital controlled', landingSuitability: 'Heavy-vessel landing access confirmed during medical pickup.', approachNotes: 'Direct atmospheric pickup selected to reduce transfer risk. Preserve gentle ascent profile for future medical work.', hazards: 'Critical patient transfer timing, surface traffic, and medical authority coordination.', previousVisits: ['Two critical patients embarked.'], knownRoutes: ['Helena medical facility -> Ares surface facility'], pilotAnnotations: 'GOOD LZ for heavy medical transfer. Keep low-jerk climb profile with medical signoff.', whyHere: 'Embarked medical patients for first professional contract.', relatedJobIds: ['job-helena-ares-medical-transfer'], relatedEntityIds: ['org-helena-medical-authority'], updatedAt: Date.now() - 90000 },
  { id: 'loc-body-ares', contactId: 'body-ares', name: 'Ares', body: 'Ares', className: 'Cold desert world / completed port call', knowledgeState: 'VERIFIED', confidence: 'CONFIRMED', x: 1031072, y: 131072, z: 1631072, altitude: 'Planetary datum', gravity: 'Planetary gravity well', atmosphere: 'Thin / cold desert', landingSuitability: 'Heavy Intrepid operations and Meridian yard access verified.', approachNotes: 'First medical delivery and major civilian refit completed. Ares Civil Continuity contacts established.', hazards: 'Fragmented frontier traffic, prospecting lanes, mercenary presence, and regional authority boundaries.', previousVisits: ['Critical patients delivered alive.', 'First paid mission completed.', 'Ares Meridian refit completed.', 'Departed for Europa.'], knownRoutes: ['Helena -> Ares non-FTL medical route', 'Ares -> Europa', 'Ares -> Pelagos via Europa'], pilotAnnotations: 'Preserve the verified arrival and departure profiles. Meridian technical support is a proven contact.', whyHere: 'Completed first paid mission, first major civilian refit, crew expansion, and Civil Continuity liaison setup.', relatedJobIds: ['job-helena-ares-medical-transfer', 'job-first-run-civilian-passengers', 'job-ares-europa-pelagos-passage'], relatedEntityIds: ['org-helena-medical-authority', 'org-ares-meridian', 'org-ares-continuity'], updatedAt: Date.now() - 60000 },
  { id: 'loc-body-europa', contactId: 'body-europa', name: 'Europa', body: 'Europa', className: 'Hydrogen ice moon / next destination', knowledgeState: 'OBSERVED', confidence: 'CONFIRMED', x: 916384, y: 16384, z: 1616384, altitude: 'Planetary datum', gravity: 'Moon gravity well', atmosphere: 'Ice moon / controlled habitats', landingSuitability: 'Approach and landing clearance not yet recorded.', approachNotes: 'Plan a roughly three-day layover. Deliver Dr. Amiel Sato, complete post-refit inspection, allow liberty, survey local organizations, and seek ordinary commercial work.', hazards: 'Hydrogen industrial traffic, abandoned installations, and unverified Relay E-17 status.', previousVisits: [], knownRoutes: ['Ares -> Europa', 'Europa -> Pelagos'], pilotAnnotations: 'No emergency profile. Give Toren time for the first sustained-operation inspection.', whyHere: 'Passenger delivery, post-refit proving, liberty, survey familiarization, and commercial opportunity.', relatedJobIds: ['job-ares-europa-pelagos-passage', 'job-relay-e17-maintenance'], relatedEntityIds: ['person-amiel-sato', 'org-ares-continuity'], updatedAt: Date.now() - 50000 },
  { id: 'loc-body-pelagos', contactId: 'body-pelagos', name: 'Pelagos', body: 'Pelagos', className: 'Ocean-heavy world / subsequent destination', knowledgeState: 'OBSERVED', confidence: 'CONFIRMED', x: 131072, y: 131072, z: 5731072, altitude: 'Planetary datum', gravity: 'Planetary gravity well', atmosphere: 'Inhabited ocean-world environment', landingSuitability: 'Exact arrival port not yet selected.', approachNotes: 'Planned after Europa. Stay may be extended rather than a simple turnaround.', hazards: 'Orbital piracy risk, maritime industrial traffic, and platform health concerns.', previousVisits: [], knownRoutes: ['Europa -> Pelagos'], pilotAnnotations: 'Arrival plan should account for several passenger destinations and potential extended operations.', whyHere: 'Deliver five onward passengers and explore longer-term commercial and infrastructure opportunities.', relatedJobIds: ['job-ares-europa-pelagos-passage'], relatedEntityIds: ['person-talia-or', 'person-nadia-kess', 'person-derrin-sol'], updatedAt: Date.now() - 40000 },
]

const initialDirectoryEntities: DirectoryEntity[] = [
  { id: 'person-johnathan-hales', kind: 'Person', name: 'Johnathan Hales', role: 'Captain / owner', relationship: 'Commanding officer', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-body-ares'], jobIds: ['job-ares-europa-pelagos-passage'], notes: 'Former Covenant Navy. Entered at 14 under waiver, served 12 years, spent approximately four aboard Intrepid and commanded her for two. Personal wealth is separate from ship operations.' },
  { id: 'person-mara-sennett', kind: 'Person', name: 'Mara Sennett', role: 'First Officer / commercial executive', relationship: 'Crew', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-station-asterion'], jobIds: ['job-first-run-civilian-passengers', 'job-helena-ares-medical-transfer'], notes: 'Responsible for making modules relational: jobs, contacts, locations, waves, transactions, and incidents should reference each other.' },
  { id: 'person-renn-harrow', kind: 'Person', name: 'Renn Harrow', role: 'Survey & Field Liaison', relationship: 'Crew', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-body-ares', 'loc-body-europa'], jobIds: ['job-ares-europa-pelagos-passage'], notes: 'Full crew. Holds a 90-day provisional Ares Civil Continuity liaison credential. May recommend aid but cannot promise aid or funding.' },
  { id: 'person-mother-calen-rusk', kind: 'Person', name: 'Mother Calen Rusk', role: 'Passenger / clergy', relationship: 'Passenger', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-station-asterion'], jobIds: ['job-first-run-civilian-passengers'], notes: 'Proposed tracking open commitments and promises that are not formal contracts.' },
  { id: 'person-tomas-coren', kind: 'Person', name: 'Tomas Coren', role: 'Passenger / minor', relationship: 'Passenger', standing: 'CONFIRMED', privacy: 'Sensitive', locationIds: ['loc-body-helena'], jobIds: ['job-first-run-civilian-passengers'], notes: 'Proposed the milestone system later renamed Ship Chronicle.' },
  { id: 'org-helena-medical-authority', kind: 'Organization', name: 'Helena Medical Authority', role: 'Medical client', relationship: 'Completed contract client', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-helena-medical-transfer', 'loc-body-ares'], jobIds: ['job-helena-ares-medical-transfer'], notes: 'Paid first contract: 118,000 credits plus fuel reimbursement for the successful delivery of two critical patients and an accompanying physician.' },
  { id: 'org-asterion-traffic', kind: 'Organization', name: 'Asterion Orbital Traffic', role: 'Port authority', relationship: 'Operational contact', standing: 'CONFIRMED', privacy: 'Public', locationIds: ['loc-station-asterion', 'loc-relay-asterion-traffic'], jobIds: [], notes: 'Recognized Intrepid registry and managed Ring Three / Port 17 docking from the Asterion Orbital cluster.' },
  { id: 'org-passenger-exchange', kind: 'Organization', name: 'Passenger Exchange', role: 'Passenger and contract broker', relationship: 'Commercial channel', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-station-asterion-exchange', 'loc-relay-passenger-exchange'], jobIds: ['job-first-run-civilian-passengers'], notes: 'Source for civilian passenger manifest, berth logistics, job brokerage, and rejected inquiries around the Asterion Commercial Exchange.' },
  { id: 'org-covenant-comms', kind: 'Organization', name: 'Covenant Comms System', role: 'Long-haul communications network', relationship: 'Registry-recognized network', standing: 'PROBABLE', privacy: 'Shipboard', locationIds: ['loc-relay-covenant'], jobIds: [], notes: 'Recognized the old Covenant registry format; long-term network reconnection relevance. Local carrier access is offset near Asterion rather than on the station grid.' },
  { id: 'org-oldearth-relay', kind: 'Organization', name: 'OldEarth Relay Network', role: 'Historic long-haul relay', relationship: 'Archive trace network', standing: 'PROBABLE', privacy: 'Shipboard', locationIds: ['loc-relay-oldearth'], jobIds: [], notes: 'Historic network used for simulated long-haul waves and Hales-family archive traces. Local access point sits near Asterion.' },
  { id: 'org-marshal-voss-net', kind: 'Organization', name: 'Marshal Voss District Net', role: 'Local authority channel', relationship: 'Courtesy contact', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-relay-marshal'], jobIds: [], notes: 'Local law and authority frequency approved by Marshal Elara Voss for the Intrepid.' },
  { id: 'org-flight-guild', kind: 'Organization', name: 'Local Flight Guild', role: 'Recruitment and credential exchange', relationship: 'Hiring channel', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-relay-flight-guild', 'loc-station-asterion-exchange'], jobIds: [], notes: 'Local hiring channel for pilots, engineers, doctors, and licensed ship personnel.' },
  { id: 'org-independent-civilian', kind: 'Organization', name: 'Independent Civilian Traffic', role: 'Loose commercial contact bucket', relationship: 'Neutral traffic', standing: 'PROBABLE', privacy: 'Public', locationIds: ['loc-relay-copper-wake', 'loc-station-asterion-exchange'], jobIds: [], notes: 'Default bucket for independent ships, bars, contractors, and unaligned commercial traffic near Asterion.' },
  { id: 'person-amiel-sato', kind: 'Person', name: 'Dr. Amiel Sato', role: 'Cryogenic systems engineer', relationship: 'Passenger / Europa delivery', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-body-europa'], jobIds: ['job-ares-europa-pelagos-passage'], notes: 'Traveling to inspect hydrogen-storage facilities on Europa.' },
  { id: 'person-talia-or', kind: 'Person', name: 'Dr. Talia Or', role: 'Public-health epidemiologist', relationship: 'Passenger / possible future contact', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-body-pelagos'], jobIds: ['job-ares-europa-pelagos-passage'], notes: 'Studying respiratory illness among Pelagos platform settlements.' },
  { id: 'person-nadia-kess', kind: 'Person', name: 'Nadia Kess', role: 'Investigative journalist / documentarian', relationship: 'Paid passenger; professionally independent', standing: 'CONFIRMED', privacy: 'Sensitive', locationIds: ['loc-body-ares', 'loc-body-pelagos'], jobIds: ['job-ares-europa-pelagos-passage'], notes: 'Age 34, Pelagos, 11 years experience. Recording boundaries apply in private or restricted spaces. Developing relationship with Captain Hales remains undefined and organic.' },
  { id: 'org-ares-meridian', kind: 'Organization', name: 'Ares Meridian Naval Works', role: 'Shipyard / refit contractor', relationship: 'Proven technical vendor', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-body-ares'], jobIds: [], notes: 'Completed the 1,981,440 credit civilian refit under the 2,000,000 authorization ceiling.' },
  { id: 'org-ares-continuity', kind: 'Organization', name: 'Ares Civil Continuity Network', role: 'Infrastructure continuity network', relationship: 'Provisional liaison contact', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: ['loc-body-ares', 'loc-body-europa'], jobIds: [], notes: 'Issued Renn a 90-day provisional liaison credential. Grants contacts and information, not authority to commit Ares or Intrepid resources.' },
  { id: 'org-carthage-relief', kind: 'Organization', name: 'Carthage Provisional Relief Authority', role: 'Verified-need relief reserve', relationship: 'Separate Hales initiative', standing: 'CONFIRMED', privacy: 'Shipboard', locationIds: [], jobIds: [], notes: '10,000,000 credits, 43 prospective volunteers, and three interested private vessel owners. No deployments, commitments, or funds spent.' },
]

const initialShipConfigurations: ShipConfigurationRecord[] = [
  { id: 'cfg-int-0001', version: 'INT-0001', date: currentIsoDate(), change: 'Carthage arrival baseline', reason: 'Create technical memory after entering Carthage operations.', shipyard: 'DSV Intrepid / Asterion Orbital', engineer: 'Toren Vask', cost: 0, notes: 'Historic former Covenant naval baseline retained for configuration history.' },
  { id: 'cfg-int-0002', version: 'INT-0002', date: currentIsoDate(), previousVersion: 'INT-0001', change: 'Shipboard medical conversion', reason: 'Support Helena-to-Ares critical-care work.', shipyard: 'Asterion medical contractors', engineer: 'Dr. Selene Vard / Toren Vask', cost: 276000, relatedJobId: 'job-helena-ares-medical-transfer', notes: 'Compact high-end trauma OR, AutoSurgDoc, recovery, isolation, advanced diagnostics, and cryogenic capability.' },
  { id: 'cfg-int-0003', version: 'INT-0003', date: currentIsoDate(), previousVersion: 'INT-0002', change: 'Major civilian refit and ABIGAIL Mk VII integration', reason: 'Modernize safety, redundancy, survey capacity, and ship intelligence after the first paid mission.', shipyard: 'Ares Meridian Naval Works', engineer: 'Toren Vask / Meridian yard team', cost: 1981440, notes: 'Authorization ceiling 2,000,000. Includes localized dampening, FTL isolation, paired atmospheric actuators, coolant harness, distributed Engineering, Medical emergency power, passenger safety, Mission Bay utilities, enhanced sensors, preserved historic scar, and ABIGAIL Mk VII.' },
]

const initialSquawks: SquawkRecord[] = [
  { id: 'squawk-dampening-overhaul', system: 'Inertial Dampening', title: 'Localized dampening modernization', state: 'CLOSED', condition: 'Certification PASS', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Dr. Selene Vard', relatedConfigId: 'cfg-int-0003', notes: 'Medical, passenger deck, bridge, and crew accommodation zones passed controller and node-failure simulations.' },
  { id: 'squawk-abigail-upgrade', system: 'ABIGAIL / Ship AI', title: 'ABIGAIL Mk VII installation', state: 'CLOSED', condition: 'ONLINE / supervised operational', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Johnathan Hales', relatedConfigId: 'cfg-int-0003', notes: 'Hard isolation remains available to Engineering. Authority limits are enforced.' },
  { id: 'squawk-refit-proving', system: 'Engineering', title: 'Complete 50-hour post-refit proving period', state: 'OPEN', condition: 'Operational; evidence collection in progress', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask', relatedConfigId: 'cfg-int-0003', notes: 'No operating restriction. Toren wants sustained-operation evidence before declaring the full refit proven.' },
  { id: 'squawk-shield-capacitor', system: 'Shields', title: 'Minor shield-capacitor thermal discrepancy', state: 'OPEN', condition: 'Observed; no operational effect', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask', relatedConfigId: 'cfg-int-0003', notes: 'Trend during the Europa leg.' },
  { id: 'squawk-dampening-latency', system: 'Inertial Dampening', title: 'Localized node startup latency', state: 'OPEN', condition: 'Slight startup delay on one node', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask', relatedConfigId: 'cfg-int-0003', notes: 'Does not affect current certification or operations.' },
  { id: 'squawk-passenger-valve', system: 'Passenger Environment', title: 'Noisy passenger environmental valve', state: 'OPEN', condition: 'Function normal; acoustic discrepancy', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Luca Bern', relatedConfigId: 'cfg-int-0003', notes: 'Inspect during Europa layover.' },
  { id: 'squawk-sensor-calibration', system: 'Sensors', title: 'Sensor calibration disagreement', state: 'WATCH', condition: 'Minor cross-package disagreement', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Renn Harrow', relatedConfigId: 'cfg-int-0003', notes: 'Compare passive, vessel-ID, geological, and atmospheric solutions.' },
  { id: 'squawk-atmo-actuators', system: 'Atmospheric Propulsion', title: 'Paired actuator bedding trend', state: 'WATCH', condition: 'Both replacements nominal', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Kessa Vale', relatedConfigId: 'cfg-int-0003', notes: 'Monitor paired load and thermal balance during next atmosphere cycle.' },
  { id: 'squawk-coolant-harness', system: 'Coolant Monitoring', title: 'Replacement harness proving trend', state: 'WATCH', condition: 'Secondary monitor harness nominal', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask', relatedConfigId: 'cfg-int-0003', notes: 'Confirm stability after sustained operation.' },
  { id: 'squawk-medical-feed', system: 'Medical Power', title: 'Independent emergency feed proving check', state: 'WATCH', condition: 'Reserve and independent feeds nominal', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Dr. Selene Vard', relatedConfigId: 'cfg-int-0003', notes: 'Exercise during post-refit inspection without disrupting Medical.' },
  { id: 'squawk-ftl-isolation', system: 'FTL Isolation', title: 'Independent isolation event logging', state: 'WATCH', condition: 'Bridge, Engineering, and local mechanical disconnect nominal', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Kessa Vale', relatedConfigId: 'cfg-int-0003', notes: 'ABIGAIL may monitor but cannot override isolation.' },
  { id: 'squawk-abigail-supervision', system: 'ABIGAIL / ShipOS', title: 'Supervised integration watch', state: 'WATCH', condition: 'All authorized integrations nominal', openedAt: currentIsoDate(), inspectionDue: currentIsoDate(), responsible: 'Toren Vask / Department Heads', relatedConfigId: 'cfg-int-0003', notes: 'Confirm authority boundaries under normal operations. Zero grounding squawks.' },
]

const initialCommitments: CommitmentRecord[] = [
  { id: 'commit-ares-medical-followup', person: 'Helena Medical Authority', promise: 'Deliver two critical-care patients to Ares under the patient-safe profile.', date: currentIsoDate(), location: 'Ares surface facility', timeframe: 'Completed first mission', status: 'Fulfilled', notes: 'Both patients arrived alive and the client paid.' },
  { id: 'commit-derrin-routing', person: 'Derrin Sol', promise: 'Carry Derrin onward to Pelagos.', date: currentIsoDate(), location: 'Pelagos', timeframe: 'After Europa layover', status: 'Open', notes: 'Routing is now confirmed.' },
  { id: 'commit-sato-europa', person: 'Dr. Amiel Sato', promise: 'Deliver Sato to Europa for hydrogen-storage inspection work.', date: currentIsoDate(), location: 'Europa', timeframe: 'Current voyage', status: 'Open', notes: 'Primary passenger delivery for the Europa stop.' },
  { id: 'commit-refit-inspection', person: 'Toren Vask', promise: 'Provide time for a sustained-operation post-refit inspection.', date: currentIsoDate(), location: 'Europa', timeframe: 'Three-day layover', status: 'Watching', notes: 'Approximately 50 operating hours desired before full proof declaration.' },
  { id: 'commit-renn-europa', person: 'Renn Harrow', promise: 'Allow evidence-led learning of Europa infrastructure and organizations without promising aid.', date: currentIsoDate(), location: 'Europa', timeframe: 'Three-day layover', status: 'Watching', notes: 'No aid commitments and no relief funds spent.' },
  { id: 'commit-future-infrastructure', person: 'Johnathan Hales', promise: 'Build ordinary, non-spectacle infrastructure links where they help communities survive and operate.', date: currentIsoDate(), location: 'Carthage / Old Earth / Judaslands interface', timeframe: 'Long horizon', status: 'Deferred', notes: 'Relief should avoid dependency theater and make basic infrastructure normal.' },
]

const initialChronicle: ChronicleEntry[] = [
  { id: 'chronicle-carthage-arrival', title: 'Carthage Arrival', stamp: Date.now() - 720000, source: 'NAV', status: 'Recorded', notes: 'The Intrepid entered the Carthage system after following ancient long-range human telemetry.' },
  { id: 'chronicle-first-crew', title: 'First Full Crew Complement', stamp: Date.now() - 360000, source: 'CREW', status: 'Recorded', notes: 'Eight-person operating household established: Hales, Sennett, Vale, Vard, Vask, Vex, Bern, and Harrow.' },
  { id: 'chronicle-first-commercial-contract', title: 'First Commercial Contract', stamp: Date.now() - 240000, source: 'JOBS', status: 'Recorded', notes: 'Helena-to-Ares critical medical transfer accepted.' },
  { id: 'chronicle-first-medical-evacuation', title: 'First Medical Evacuation', stamp: Date.now() - 180000, source: 'MEDICAL', status: 'Recorded', notes: 'Two critical-care patients survived the Helena-to-Ares transfer.' },
  { id: 'chronicle-first-ares-landing', title: 'First Ares Landing', stamp: Date.now() - 150000, source: 'NAV', status: 'Recorded', notes: 'Medical delivery, liberty, crew expansion, and refit port call completed.' },
  { id: 'chronicle-first-major-refit', title: 'First Major Civilian Refit', stamp: Date.now() - 120000, source: 'ENGINEERING', status: 'Recorded', notes: 'Ares Meridian completed the 1,981,440 credit modernization.' },
  { id: 'chronicle-abigail-online', title: 'ABIGAIL Mk VII Online', stamp: Date.now() - 90000, source: 'SHIPOS', status: 'Recorded', notes: 'Independent vessel intelligence entered supervised operations with hard authority limits.' },
  { id: 'chronicle-renn-joins', title: 'Renn Joins the Crew', stamp: Date.now() - 70000, source: 'CREW', status: 'Recorded', notes: 'Renn Harrow converted from passenger to Survey & Field Liaison.' },
  { id: 'chronicle-europa-run', title: 'Europa Run', stamp: Date.now() - 50000, source: 'NAV', status: 'Recorded', notes: 'Departed Ares for Europa with eight crew, seven passengers, and green ship status.' },
  { id: 'chronicle-first-unknown-signal', title: 'First Unknown Signal Investigated', stamp: Date.now(), source: 'SURVEY', status: 'Pending', notes: 'No qualifying investigation logged yet.' },
  { id: 'chronicle-100000km', title: '100,000 km Traveled', stamp: Date.now(), source: 'TELEMETRY', status: 'Pending', notes: 'Will become automatic once telemetry trail distance supports it.' },
]

const initialMedicalFacilities: MedicalFacilityRecord[] = [
  { id: 'med-helena-transfer', name: 'Helena Medical Transfer Facility', locationId: 'loc-helena-medical-transfer', access: 'Heavy-vessel landing verified', capabilities: ['Emergency', 'Trauma', 'Stabilization', 'Industrial injury', 'Patient transfer'], travelNote: 'Historic origin facility for the first paid mission.', notes: 'Direct Intrepid pickup profile is verified.' },
  { id: 'med-ares-receiving', name: 'Ares Receiving Facility', locationId: 'loc-body-ares', access: 'Critical-care receiving verified', capabilities: ['Emergency', 'Trauma', 'Surgery', 'Critical care'], travelNote: 'Both first-mission patients were delivered alive.', notes: 'Proven receiving contact.' },
  { id: 'med-intrepid-clinic', name: 'DSV Intrepid Ship Clinic', locationId: 'ship-current-position', access: 'Shipboard / Medical authority', capabilities: ['Emergency', 'Trauma surgery', 'AutoSurgDoc', 'Recovery', 'Isolation', 'Advanced diagnostics', 'Cryogenic medicine', 'Independent emergency power'], travelNote: 'Aboard and unrestricted.', notes: 'Protected charts remain inaccessible to ABIGAIL without authorization.' },
]

const initialSecurityIncidents: SecurityIncidentRecord[] = [
  { id: 'incident-rejected-charter', title: 'Undisclosed outer-system charter declined', locationId: 'loc-station-asterion', confidence: 'CONFIRMED', permission: 'Shipboard', involved: ['Vale Orlan', 'Passenger Exchange'], outcome: 'Declined politely', notes: 'Location remains ordinary Asterion contact; the incident does not make Asterion hostile territory.' },
  { id: 'incident-weapons-request', title: 'Passenger weapon access request declined', locationId: 'loc-station-asterion', confidence: 'CONFIRMED', permission: 'Shipboard', involved: ['Joren Kael'], outcome: 'Declined for first run', notes: 'Could reappear later. Track as incident, not location reputation.' },
]

const initialStoresRecords: StoresRecord[] = [
  { id: 'store-ice', item: 'Ice', quantity: 18400, unit: 'kg', storage: 'A1 resource bay', desiredMinimum: 12000, purchaseLocation: 'Asterion Orbital / hydrogen suppliers', lastPrice: 0, notes: 'Telemetry cargo percentage will eventually reconcile against stores.' },
  { id: 'store-passenger-rations', item: 'Passenger provisions', quantity: 15, unit: 'person-days', storage: 'Upper cabins / galley stores', desiredMinimum: 30, purchaseLocation: 'Europa market', lastPrice: 0, notes: 'Current planning basis is 15 souls and all six passenger cabins occupied.' },
  { id: 'store-coffee', item: 'Coffee', quantity: 6, unit: 'kg', storage: 'Galley dry stores', desiredMinimum: 8, purchaseLocation: 'Asterion dockside grocer', lastPrice: 0, notes: 'Supply Atlas candidate: good coffee matters on long legs.' },
  { id: 'store-med-oxygen', item: 'Medical oxygen reserve', quantity: 2, unit: 'tanks', storage: 'Medical bay', desiredMinimum: 4, purchaseLocation: 'Ares / Europa medical supplier', lastPrice: 0, notes: 'Now backed by independent Medical emergency feeds and reserve power.' },
  { id: 'store-fresh-produce', item: 'Fresh produce', quantity: 3, unit: 'crates', storage: 'Galley cold locker', desiredMinimum: 5, purchaseLocation: 'Helena agricultural market', lastPrice: 0, expiration: currentIsoDate(), notes: 'Track expiration and port price comparisons later.' },
  { id: 'store-herb-wall', item: 'Modular hydroponic herb wall', quantity: 1, unit: 'installation', storage: 'Galley', desiredMinimum: 1, purchaseLocation: 'Installed aboard', lastPrice: 0, notes: 'Maintained by Luca Bern with Iria Vale.' },
]

const hairColorPresets = ['#1e1511', '#4d2f1c', '#77512d', '#b7834d', '#d8c3a2', '#121417', '#5b6069', '#8b2f24']
const eyeColorPresets = ['#5b3a22', '#7a4f2a', '#3f6f54', '#2f6f8f', '#7088b8', '#9a7349', '#66736f']
const uniformColorPresets = ['#243f66', '#5d2831', '#314b3c', '#6b5b37', '#202529', '#d8d2c7', '#82482d', '#2b5f73']
const accentColorPresets = ['#7de8d2', '#f6b94d', '#e66f5c', '#8fb4ff', '#d68ebd', '#75d69d', '#f1e2c6']
const skinTonePresets = ['#f1c7a6', '#d7a379', '#b77956', '#8f563d', '#6f3f2e', '#4b2b23']
const metagameKinds: MetagameRecord['kind'][] = ['Character', 'Faction', 'Location', 'Mystery', 'Rumor', 'Contract', 'System Note']
const metagameVisibilities: MetagameRecord['visibility'][] = ['Canon', 'GM-only', 'Rumor', 'Not Yet Established']

const relayNetworks = [
  'Asterion Orbital Traffic',
  'Marshal Voss District Net',
  'Local Flight Guild',
  'Passenger Exchange',
  'OldEarth Relay Network',
  'Covenant Comms System',
  'Independent Deep Space Beacons',
]

const reliefAuthorityBudget = 10000000
const reliefVolunteerBreakdown = [
  { specialty: 'Medical', count: 9 },
  { specialty: 'Engineering / Infrastructure', count: 11 },
  { specialty: 'Flight-qualified', count: 6 },
  { specialty: 'Logistics', count: 4 },
  { specialty: 'Agricultural', count: 3 },
  { specialty: 'Security / Rescue', count: 5 },
  { specialty: 'Unclassified Enthusiasts', count: 5 },
]
const reliefVolunteerVesselCount = 3
const rennHarrowCrewProfile = {
  name: 'Renn Harrow',
  billet: 'Survey & Field Liaison',
  rateMonthly: 2500,
  credential: '90-day provisional Ares Civil Continuity liaison',
  quarters: 'Private Deck A crew cabin',
  authority: 'May recommend aid but cannot promise aid or funding. Secondary sensor and reconnaissance duties remain under Flight.',
}

const echoMailFolders: Array<{ id: EchoMailFolder; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'sent', label: 'Sent' },
  { id: 'pending', label: 'Pending' },
  { id: 'hails', label: 'Hails' },
  { id: 'all', label: 'All Mail' },
]

const wavePriorityOptions: Array<{ id: WavePriority; label: string }> = [
  { id: 'routine', label: 'Routine' },
  { id: 'priority', label: 'Priority' },
  { id: 'urgent', label: 'Urgent' },
]

const waveChannelOptions: Array<{ id: WaveChannel; label: string }> = [
  { id: 'wave', label: 'Wave Mail' },
  { id: 'hail', label: 'Open Hail' },
  { id: 'ship-to-ship', label: 'Ship to Ship' },
  { id: 'ship-to-shore', label: 'Ship to Shore' },
  { id: 'docking', label: 'Docking / Landing' },
]

const createDefaultWaveDraft = (): WaveDraft => ({
  network: relayNetworks[0],
  to: 'Asterion Traffic Control',
  subject: '',
  body: '',
  crewTarget: '',
  priority: 'routine',
  channel: 'wave',
  contactId: '',
})

const shipSystemRows = [
  { name: 'Hull integrity', value: 98, note: 'Internal port-spine structure restored; exterior combat scar intentionally preserved' },
  { name: 'Hydrogen reserve', value: 78, note: 'Fallback planning estimate until the next live telemetry packet' },
  { name: 'Battery charge', value: 82, note: 'Fallback planning estimate until the next live telemetry packet' },
  { name: 'Jump drive charge', value: 74, note: 'FTL-capable; live charge replaces this fallback when telemetry is present' },
  { name: 'FTL readiness', value: 100, note: 'Solid-state isolation certified; Bridge, Engineering, and local disconnect retain authority' },
  { name: 'Weapons status', value: 100, note: 'Military-derived systems operational; ABIGAIL cannot authorize or fire weapons' },
  { name: 'Medical suite', value: 100, note: 'AutoSurgDoc, surgery, isolation, recovery, cryogenic support, and independent emergency power' },
  { name: 'Passenger safety', value: 100, note: 'Emergency atmosphere and improved fire isolation installed' },
  { name: 'Sensor package', value: 100, note: 'Enhanced passive, identification, geological, atmospheric, and survey capability' },
]

const initialPosition: ShipCoordinate = { x: 42000, y: 142000, z: -98000 }
const mapScale = 1 / 56000
const liveMapTargetRadius = 168
const liveMapMinOuterRangeMeters = 35000
const liveMapMaxOuterRangeMeters = 360000
const liveMapReferenceFloorMeters = 180000
const liveMapRangeRingsMeters = [4000, 8000, 25000, 100000, 250000]
const mapLabelSizeMultiplier = 1.3
const defenseEnvelopeRingsMeters = [4000, 8000]
const asteroidCautionEnvelopeMeters = 2000
const contactEnvelopeRingsMeters = [4000]
const masterAlarmAltitudeCautionMeters = 1000
const masterAlarmCautionDurationMs = 5000
const orbitLineSegments = 160
const defaultBridgeEndpoint = 'http://127.0.0.1:8795/telemetry/latest'
const cloudBridgeEndpoint = '/api/shipos/telemetry/latest'
const cloudBridgeHealthEndpoint = '/api/shipos/telemetry/health'
const fallbackBridgeEndpoints = [
  defaultBridgeEndpoint,
  'http://localhost:8795/telemetry/latest',
]
const telemetryHistoryLimit = 240
const blueprintModelBlockLimit = 6000
const currentShipContactId = 'ship-current-position'

const bodyRadiusMeters: Record<string, number> = {
  'body-helena': 60000,
  'body-mourning': 9500,
  'body-ares': 60000,
  'body-europa': 9500,
  'body-pelagos': 60000,
  'body-vesper': 9500,
  'body-triton': 40126.5,
  'body-pertam': 30066.5,
}

const asteroidNameAdjectives = [
  'Amber',
  'Blackglass',
  'Cinder',
  'Copper',
  'Ebon',
  'Farwake',
  'Glass',
  'Iron',
  'Keel',
  'Lantern',
  'Mourning',
  'Nickel',
  'Obsidian',
  'Pale',
  'Rime',
  'Sable',
  'Vesper',
  'Warden',
]

const asteroidNameNouns = [
  'Anchor',
  'Anvil',
  'Break',
  'Cairn',
  'Crown',
  'Drift',
  'Hollow',
  'Knife',
  'Lantern',
  'Needle',
  'Reef',
  'Shard',
  'Shelf',
  'Spindle',
  'Spur',
  'Wake',
]

const plottedContactKinds: { id: ShipContactKind; label: string; className: string }[] = [
  { id: 'gps', label: 'GPS Point', className: 'GPS fix' },
  { id: 'waypoint', label: 'Waypoint', className: 'Navigation waypoint' },
  { id: 'asteroid', label: 'Asteroid', className: 'Asteroid / resource contact' },
  { id: 'radar', label: 'Radar Contact', className: 'Radar contact' },
  { id: 'signal', label: 'Unidentified Signal', className: 'Unidentified signal' },
  { id: 'ship', label: 'Ship', className: 'Vessel contact' },
  { id: 'station', label: 'Station', className: 'Station contact' },
  { id: 'relay', label: 'Relay', className: 'Communications relay' },
]

const contactClassFilterOptions: { id: ContactClassFilterId; label: string }[] = [
  { id: 'bodies', label: 'Planets / Moons' },
  { id: 'stations', label: 'Stations' },
  { id: 'ships', label: 'Ships' },
  { id: 'asteroids', label: 'Asteroids' },
  { id: 'radar', label: 'Radar' },
  { id: 'signals', label: 'Signals' },
  { id: 'gpsWaypoints', label: 'GPS (Pinned) / Waypoints' },
  { id: 'relays', label: 'Relays' },
]

const contactIffFilterOptions: { id: ContactIffFilterId; label: string }[] = [
  { id: 'owned', label: 'Owned Grids (Pinned)' },
  { id: 'friendly', label: 'Friendly (Pinned)' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'hostile', label: 'Hostile' },
  { id: 'unknown', label: 'Unknown' },
]

const contactSortOptions: { id: ContactSortKey; label: string }[] = [
  { id: 'distance', label: 'Range' },
  { id: 'name', label: 'Name' },
  { id: 'kind', label: 'Type' },
  { id: 'iff', label: 'IFF' },
  { id: 'faction', label: 'Faction' },
  { id: 'source', label: 'Source' },
  { id: 'className', label: 'Class' },
  { id: 'status', label: 'Status' },
]

const contactDispositionOptions: { id: ContactDispositionId; label: string; note: string }[] = [
  { id: 'auto', label: 'Auto', note: 'Use telemetry' },
  { id: 'owned', label: 'Owned Grid', note: 'Your armed grid' },
  { id: 'friendly', label: 'Friendly', note: 'Green contact' },
  { id: 'neutral', label: 'Neutral', note: 'Civil contact' },
  { id: 'hostile', label: 'Hostile', note: 'Red contact' },
  { id: 'unknown', label: 'Unknown', note: 'Unresolved' },
]

const defaultContactClassFilters: Record<ContactClassFilterId, boolean> = {
  bodies: true,
  stations: true,
  ships: true,
  asteroids: true,
  radar: true,
  signals: true,
  gpsWaypoints: true,
  relays: true,
}

const defaultContactIffFilters: Record<ContactIffFilterId, boolean> = {
  owned: true,
  friendly: true,
  neutral: true,
  hostile: true,
  unknown: true,
}

const defaultContactSortState: ContactSortState = {
  key: 'distance',
  direction: 'asc',
}

const unassignedFactionFilterId = 'faction-unassigned'

const shipOsFontFaceOptions: { id: ShipOsFontFace; label: string; family: string }[] = [
  { id: 'tech', label: 'Tech', family: '"Share Tech Mono", "IBM Plex Mono", "Rajdhani", "Eurostile", "Bank Gothic", Consolas, monospace' },
  { id: 'sans', label: 'Sans', family: 'Inter, "Segoe UI", Arial, sans-serif' },
  { id: 'serif', label: 'Serif', family: '"Iowan Old Style", "Palatino Linotype", Georgia, serif' },
]

const defaultShipOsDisplayPreferences: ShipOsDisplayPreferences = {
  fontSize: 13,
  fontFace: 'tech',
}

const contactImageStorageSoftLimit = 2_400_000
const contactImageLibraryLimit = 32
const shipOsStateChangedEvent = 'shipos:state-changed'
const shipOsStateHydratedEvent = 'shipos:state-hydrated'
const shipOsPersistenceErrorEvent = 'shipos:persistence-error'
const shipOsRemoteRevisionKey = 'shipos-sync-remote-revision'
const shipOsRemoteUpdatedAtKey = 'shipos-sync-remote-updated-at'
const shipOsLocalDirtyAtKey = 'shipos-sync-local-dirty-at'
const shipOsLocalOnlyStateKeys = new Set([
  'shipos-current-position',
  'shipos-last-telemetry-packet',
  'shipos-telemetry-history',
  'shipos-contact-memory',
  'shipos-contact-memory-visible',
  'shipos-bridge-config',
  'shipos-display-preferences',
  'shipos-alarm-sound-uplink-enabled',
])

function isShipOsSynchronizedStateKey(key: string) {
  return key.startsWith('shipos-')
    && !key.startsWith('shipos-sync-')
    && !shipOsLocalOnlyStateKeys.has(key)
}

function collectShipOsLocalState(includeLocalOnly = false) {
  const state: Record<string, unknown> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith('shipos-') || key.startsWith('shipos-sync-') || (!includeLocalOnly && !isShipOsSynchronizedStateKey(key))) continue
    const raw = window.localStorage.getItem(key)
    if (raw === null) continue
    try {
      state[key] = JSON.parse(raw) as unknown
    } catch {
      state[key] = raw
    }
  }
  return state
}

function applyShipOsRemoteState(state: Record<string, unknown>) {
  const remoteEntries = Object.entries(state).filter(([key]) => isShipOsSynchronizedStateKey(key))
  const remoteKeys = new Set(remoteEntries.map(([key]) => key))
  const localKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key))
  const changedKeys = new Set<string>()

  localKeys.forEach((key) => {
    if (!isShipOsSynchronizedStateKey(key) || remoteKeys.has(key)) return
    window.localStorage.removeItem(key)
    changedKeys.add(key)
  })

  remoteEntries.forEach(([key, value]) => {
    const serialized = JSON.stringify(value)
    if (window.localStorage.getItem(key) === serialized) return
    window.localStorage.setItem(key, serialized)
    changedKeys.add(key)
  })

  return [...changedKeys]
}

function applyShipOsBackupState(state: Record<string, unknown>) {
  Object.entries(state).forEach(([key, value]) => {
    if (!key.startsWith('shipos-') || key.startsWith('shipos-sync-')) return
    window.localStorage.setItem(key, JSON.stringify(value))
  })
}

function shipOsStateSignature(state: Record<string, unknown>) {
  return JSON.stringify(Object.keys(state).sort().map((key) => [key, state[key]]))
}

function usePersistentState<T>(key: string, initialValue: T) {
  const didMountRef = useRef(false)
  const initialValueRef = useRef(initialValue)
  const valueRef = useRef<T>(initialValue)
  const suppressNextChangeRef = useRef(false)
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    const raw = window.localStorage.getItem(key)
    if (!raw) return initialValue
    try {
      return JSON.parse(raw) as T
    } catch {
      return initialValue
    }
  })

  valueRef.current = value

  useEffect(() => {
    const hydrateValue = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys
      if (keys && !keys.includes(key)) return

      const raw = window.localStorage.getItem(key)
      let nextValue = initialValueRef.current
      if (raw) {
        try {
          nextValue = JSON.parse(raw) as T
        } catch {
          nextValue = initialValueRef.current
        }
      }

      if (JSON.stringify(valueRef.current) === JSON.stringify(nextValue)) return
      suppressNextChangeRef.current = true
      valueRef.current = nextValue
      setValue(nextValue)
    }

    window.addEventListener(shipOsStateHydratedEvent, hydrateValue)
    return () => window.removeEventListener(shipOsStateHydratedEvent, hydrateValue)
  }, [key])

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
      const suppressChange = suppressNextChangeRef.current
      suppressNextChangeRef.current = false
      if (didMountRef.current && !suppressChange && !shipOsLocalOnlyStateKeys.has(key)) {
        const changedAt = Date.now()
        window.localStorage.setItem(shipOsLocalDirtyAtKey, String(changedAt))
        window.dispatchEvent(new CustomEvent(shipOsStateChangedEvent, { detail: { key, changedAt } }))
      }
      didMountRef.current = true
    } catch (error) {
      console.warn(`ShipOS could not persist ${key}.`, error)
      window.dispatchEvent(new CustomEvent(shipOsPersistenceErrorEvent, { detail: { key } }))
    }
  }, [key, value])

  return [value, setValue] as const
}

function createDefaultContactFilters(): ContactFilterState {
  return {
    classes: { ...defaultContactClassFilters },
    iff: { ...defaultContactIffFilters },
    factions: {},
  }
}

function normalizeContactFilters(filters?: Partial<ContactFilterState> | null, factionIds: string[] = []): ContactFilterState {
  const classes = { ...defaultContactClassFilters }
  const iff = { ...defaultContactIffFilters }
  const factions = { ...(filters?.factions ?? {}) }
  const incomingClasses = (filters?.classes ?? {}) as Partial<Record<ContactClassFilterId, boolean>>
  const incomingIff = (filters?.iff ?? {}) as Partial<Record<ContactIffFilterId, boolean>>

  contactClassFilterOptions.forEach((option) => {
    const enabled = incomingClasses[option.id]
    if (typeof enabled === 'boolean') classes[option.id] = enabled
  })
  contactIffFilterOptions.forEach((option) => {
    const enabled = incomingIff[option.id]
    if (typeof enabled === 'boolean') iff[option.id] = enabled
  })
  factionIds.forEach((id) => {
    const enabled = factions[id]
    factions[id] = typeof enabled === 'boolean' ? enabled : true
  })

  return { classes, iff, factions }
}

function upsertRecords<T extends { id: string }>(current: T[], canonical: T[], retiredIds: string[] = []) {
  const canonicalIds = new Set(canonical.map((item) => item.id))
  const retired = new Set(retiredIds)
  return [
    ...canonical,
    ...current.filter((item) => !canonicalIds.has(item.id) && !retired.has(item.id)),
  ]
}

function formatCoord(value: number) {
  return Math.round(value).toLocaleString()
}

function distanceMeters(left: ShipCoordinate, right: ShipCoordinate) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

function planarDistanceMeters(left: ShipCoordinate, right: ShipCoordinate) {
  return Math.hypot(left.x - right.x, left.z - right.z)
}

function formatKm(value: number) {
  const kilometers = value / 1000
  const digits = Math.abs(kilometers) >= 100 ? 0 : 1
  return `${kilometers.toLocaleString(undefined, { maximumFractionDigits: digits })} km`
}

function normalizeBodyLookupName(value?: string | null) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function bodyIdFromChartName(value?: string | null) {
  const normalized = normalizeBodyLookupName(value)
  if (!normalized) return ''
  const direct = starSystemBodies.find((body) => normalizeBodyLookupName(body.name) === normalized || normalizeBodyLookupName(body.id) === normalized)
  if (direct) return direct.id
  const entry = Object.entries(bodyCalibrationAliases).find(([, aliases]) => aliases.some((alias) => normalizeBodyLookupName(alias) === normalized))
  return entry?.[0] ?? ''
}

function bodyIdFromContactForCalibration(contact: ShipContact) {
  const entityId = contact.entityId?.trim() ?? ''
  if (entityId && bodyIdByEntityId.has(entityId)) return bodyIdByEntityId.get(entityId) ?? ''
  const storageName = contact.storageName?.trim().toLowerCase() ?? ''
  if (storageName && bodyIdByStorageName.has(storageName)) return bodyIdByStorageName.get(storageName) ?? ''
  if (contact.contactSource === 'planet-registry' && (entityId || storageName)) return ''
  return bodyIdFromChartName(contact.name)
    || bodyIdFromChartName(contact.sourceName)
    || bodyIdFromChartName(contact.generatorName)
    || bodyIdFromChartName(contact.className)
    || bodyIdFromChartName(contact.status)
}

function applyPlanetaryChartOverrides(bodies: ShipContact[], overrides: PlanetaryChartOverrides): ShipContact[] {
  return bodies.map((body) => {
    const override = overrides[body.id]
    if (!override) return body
    return {
      ...body,
      x: override.x,
      y: override.y,
      z: override.z,
      radiusMeters: override.radiusMeters ?? body.radiusMeters,
      entityId: override.entityId ?? body.entityId,
      generatorName: override.generatorName ?? body.generatorName,
      storageName: override.storageName ?? body.storageName,
      status: `${body.status} | calibrated`,
      notes: `${body.notes} Chart calibration source: ${override.source}.`,
    }
  })
}

function createDefaultPlanetaryCalibrationDraft(bodyId = starSystemBodies[0]?.id ?? ''): PlanetaryCalibrationDraft {
  const body = starSystemBodies.find((item) => item.id === bodyId) ?? starSystemBodies[0]
  return {
    bodyId: body?.id ?? '',
    x: body ? String(Math.round(body.x)) : '',
    y: body ? String(Math.round(body.y)) : '',
    z: body ? String(Math.round(body.z)) : '',
    gpsLines: '',
  }
}

function planetaryCalibrationDraftFromBody(body: ShipContact): PlanetaryCalibrationDraft {
  return {
    bodyId: body.id,
    x: String(Math.round(body.x)),
    y: String(Math.round(body.y)),
    z: String(Math.round(body.z)),
    gpsLines: '',
  }
}

function parsePlanetCalibrationGpsLines(raw: string): Array<{ bodyId: string; coordinate: ShipCoordinate; name: string }> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^GPS:([^:]*):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):?/i)
      if (!match) return null
      const bodyId = bodyIdFromChartName(match[1])
      if (!bodyId) return null
      const x = Number(match[2])
      const y = Number(match[3])
      const z = Number(match[4])
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
      return { bodyId, coordinate: { x, y, z }, name: match[1]?.trim() || bodyId }
    })
    .filter((item): item is { bodyId: string; coordinate: ShipCoordinate; name: string } => Boolean(item))
}

function planetaryOverridesFromTelemetryContacts(contacts: ShipContact[]) {
  const overrides: Array<{ bodyId: string; override: PlanetaryChartOverride }> = []
  contacts.forEach((contact) => {
    if (contact.kind !== 'body') return
    const bodyId = bodyIdFromContactForCalibration(contact)
    if (!bodyId) return
    overrides.push({
      bodyId,
      override: {
        x: contact.x,
        y: contact.y,
        z: contact.z,
        source: `Telemetry body contact ${contact.sourceName || contact.name}`,
        originalName: contact.sourceName || contact.name,
        radiusMeters: contact.radiusMeters,
        entityId: contact.entityId,
        generatorName: contact.generatorName,
        storageName: contact.storageName,
        updatedAt: Date.now(),
      },
    })
  })
  return overrides
}

function planetaryChartOverrideMatches(left: PlanetaryChartOverride | undefined, right: PlanetaryChartOverride) {
  if (!left) return false
  return Math.abs(left.x - right.x) < 0.5
    && Math.abs(left.y - right.y) < 0.5
    && Math.abs(left.z - right.z) < 0.5
    && Math.abs((left.radiusMeters ?? 0) - (right.radiusMeters ?? 0)) < 0.5
    && (left.entityId ?? '') === (right.entityId ?? '')
    && (left.generatorName ?? '') === (right.generatorName ?? '')
    && (left.storageName ?? '') === (right.storageName ?? '')
    && left.source === right.source
}

function isKnownPlanetaryChartContact(contact: ShipContact) {
  return contact.kind === 'body' && Boolean(bodyIdFromContactForCalibration(contact))
}

function applyBodyCalibrationToLocation(location: LocationRecord, bodies: ShipContact[]) {
  if (!location.contactId) return location
  const body = bodies.find((item) => item.id === location.contactId)
  if (!body) return location
  return {
    ...location,
    name: location.name || body.name,
    body: body.name,
    x: body.x,
    y: body.y,
    z: body.z,
    updatedAt: Math.max(location.updatedAt, Date.now()),
  }
}

function calibrationSummaryForBody(body: ShipContact, overrides: PlanetaryChartOverrides) {
  const override = overrides[body.id]
  if (!override) return 'Preset'
  return `${override.source} | ${new Date(override.updatedAt).toLocaleString()}`
}

function normalizeFactionName(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function factionKey(value: string) {
  return normalizeFactionName(value).toLowerCase()
}

function factionFilterIdForName(name: string) {
  const clean = normalizeFactionName(name)
  if (!clean) return unassignedFactionFilterId
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'faction'
  return `faction-${slug}-${hashString(clean).toString(36)}`
}

function inferContactFactionName(contact: ShipContact) {
  const relationship = contact.relationship?.trim().toLowerCase() ?? ''
  const haystack = [
    contact.name,
    contact.className,
    contact.status,
    contact.notes,
    contact.sourceName,
    contact.antennaName,
    contact.contactSource,
    relationship,
  ].map((value) => String(value || '')).join(' ').toLowerCase()

  if (contact.id === currentShipContactId || relationship === 'owned' || /\bowned\b/.test(haystack)) return 'DSV Intrepid'
  if (contact.kind === 'body') return ''
  if (haystack.includes('asterion')) return 'Asterion Orbital Traffic'
  if (haystack.includes('helena medical')) return 'Helena Medical Authority'
  if (haystack.includes('passenger exchange')) return 'Passenger Exchange'
  if (haystack.includes('covenant')) return 'Covenant Comms System'
  if (haystack.includes('oldearth') || haystack.includes('old earth')) return 'OldEarth Relay Network'
  if (haystack.includes('marshal voss')) return 'Marshal Voss District Net'
  if (haystack.includes('flight guild')) return 'Local Flight Guild'
  if (/\b(civilian|commercial|merchant|independent)\b/.test(haystack)) return 'Independent Civilian Traffic'
  return ''
}

function contactFactionName(contact: ShipContact) {
  return normalizeFactionName(contact.faction) || inferContactFactionName(contact)
}

function contactFactionFilterId(contact: ShipContact) {
  return factionFilterIdForName(contactFactionName(contact))
}

function applyContactFactionAssignment(contact: ShipContact, faction?: string): ShipContact {
  const clean = normalizeFactionName(faction)
  return clean ? { ...contact, faction: clean } : contact
}

function createContactFactionOptions(
  contacts: ShipContact[],
  metagameRecords: MetagameRecord[],
  directoryEntities: DirectoryEntity[],
): ContactFactionOption[] {
  const options = new Map<string, ContactFactionOption>()
  const addOption = (name: string, source: string) => {
    const clean = normalizeFactionName(name)
    if (!clean) return
    const key = factionKey(clean)
    if (options.has(key)) return
    options.set(key, { id: factionFilterIdForName(clean), label: clean, source })
  }

  addOption('DSV Intrepid', 'Ownship')
  relayNetworks.forEach((name) => addOption(name, 'Comms network'))
  addOption('Independent Civilian Traffic', 'Default faction')
  metagameRecords
    .filter((record) => record.kind === 'Faction')
    .forEach((record) => addOption(record.name, `Metagame / ${record.visibility}`))
  directoryEntities
    .filter((entity) => entity.kind === 'Organization' || entity.kind === 'Faction')
    .forEach((entity) => addOption(entity.name, `Directory / ${entity.kind}`))
  contacts.forEach((contact) => addOption(contactFactionName(contact), 'Contact file'))

  return [
    { id: unassignedFactionFilterId, label: 'Unassigned / Unknown', source: 'No faction tag' },
    ...Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label)),
  ]
}

function formatByteSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1024)).toLocaleString()} KB`
}

function dataUrlByteSize(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('Image file could not be read.'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image file could not be decoded.'))
    image.src = src
  })
}

async function prepareContactImageAttachment(file: File, contact: ShipContact): Promise<ContactImageAttachment> {
  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImageElement(sourceUrl)
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image compressor is unavailable in this browser.')
  context.drawImage(image, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.84)
  return {
    id: `contact-image-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    contactId: contact.id,
    contactName: contactFileTitle(contact),
    fileName: file.name || 'screenshot.jpg',
    caption: '',
    dataUrl,
    width,
    height,
    byteSize: dataUrlByteSize(dataUrl),
    createdAt: Date.now(),
  }
}

function formatCredits(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}${Math.abs(Math.round(value)).toLocaleString()} cr`
}

function clampPercent(value?: number) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Number(value)))
}

function telemetryPercent(value?: number, fallback = 0) {
  return clampPercent(value) ?? fallback
}

function coerceTelemetryNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function coerceTelemetryBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'on'].includes(normalized)) return true
    if (['false', 'no', '0', 'off'].includes(normalized)) return false
  }
  return undefined
}

function normalizeTelemetryPacket(payload: Record<string, unknown>): TelemetryPacket {
  const normalized = { ...payload } as TelemetryPacket
  const numberKeys = [
    'version',
    'sequence',
    'x',
    'y',
    'z',
    'velocityX',
    'velocityY',
    'velocityZ',
    'angularVelocityX',
    'angularVelocityY',
    'angularVelocityZ',
    'speed',
    'mass',
    'naturalGravity',
    'surfaceAltitude',
    'seaLevelAltitude',
    'verticalSpeed',
    'horizontalSpeed',
    'gravityX',
    'gravityY',
    'gravityZ',
    'forwardX',
    'forwardY',
    'forwardZ',
    'upX',
    'upY',
    'upZ',
    'planetCenterX',
    'planetCenterY',
    'planetCenterZ',
    'terrainScanRange',
    'terrainScanWidth',
    'terrainScanRows',
    'terrainScanColumns',
    'batteryPercent',
    'hydrogenPercent',
    'oxygenPercent',
    'jumpPercent',
    'reactorPercent',
    'thrustPercent',
    'cargoPercent',
    'cargoCurrentVolume',
    'cargoMaxVolume',
    'terminalBlockCount',
    'functionalBlockCount',
    'nonFunctionalBlockCount',
    'notWorkingBlockCount',
    'batteryCount',
    'gasTankCount',
    'hydrogenTankCount',
    'oxygenTankCount',
    'jumpDriveCount',
    'reactorCount',
    'inventoryCount',
    'thrusterCount',
    'gyroCount',
    'connectorCount',
    'connectedConnectorCount',
    'landingGearCount',
    'lockedLandingGearCount',
    'airVentCount',
    'pressurizedVentCount',
    'antennaCount',
    'weaponCount',
    'toolCount',
    'instructionCount',
  ]

  numberKeys.forEach((key) => {
    const value = coerceTelemetryNumber((payload as Record<string, unknown>)[key])
    if (value === undefined) delete (normalized as Record<string, unknown>)[key]
    else (normalized as Record<string, unknown>)[key] = value
  })

  const numberAliases: Array<[string, keyof TelemetryPacket]> = [
    ['vx', 'velocityX'],
    ['vy', 'velocityY'],
    ['vz', 'velocityZ'],
    ['avx', 'angularVelocityX'],
    ['avy', 'angularVelocityY'],
    ['avz', 'angularVelocityZ'],
  ]

  numberAliases.forEach(([alias, key]) => {
    if ((normalized as Record<string, unknown>)[key] !== undefined) return
    const value = coerceTelemetryNumber((payload as Record<string, unknown>)[alias])
    if (value !== undefined) (normalized as Record<string, unknown>)[key] = value
  })

  const dampeners = coerceTelemetryBoolean(payload.dampeners)
  const underControl = coerceTelemetryBoolean(payload.underControl)
  if (dampeners !== undefined) normalized.dampeners = dampeners
  if (underControl !== undefined) normalized.underControl = underControl

  if (Array.isArray(payload.terrainScan)) {
    normalized.terrainScan = payload.terrainScan.flatMap((rawSample) => {
      if (!rawSample || typeof rawSample !== 'object') return []
      const sample = rawSample as Record<string, unknown>
      const row = coerceTelemetryNumber(sample.row)
      const column = coerceTelemetryNumber(sample.column)
      const ahead = coerceTelemetryNumber(sample.ahead)
      const lateral = coerceTelemetryNumber(sample.lateral)
      const clearance = coerceTelemetryNumber(sample.clearance)
      const surfaceDelta = coerceTelemetryNumber(sample.surfaceDelta)
      if ([row, column, ahead, lateral, clearance].some((value) => value === undefined)) return []
      return [{
        row: Number(row),
        column: Number(column),
        ahead: Number(ahead),
        lateral: Number(lateral),
        clearance: Number(clearance),
        surfaceDelta: surfaceDelta === undefined ? 0 : Number(surfaceDelta),
      }]
    })
  }

  return normalized
}

function parseTelemetryPacket(raw: string): TelemetryPacket {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('Telemetry packet must be a JSON object.')
  return normalizeTelemetryPacket(parsed as Record<string, unknown>)
}

function hasTelemetryCoordinate(packet: TelemetryPacket) {
  return Number.isFinite(packet.x) && Number.isFinite(packet.y) && Number.isFinite(packet.z)
}

function coordinateFromTelemetry(packet: TelemetryPacket): ShipCoordinate | null {
  if (!hasTelemetryCoordinate(packet)) return null
  return { x: Number(packet.x), y: Number(packet.y), z: Number(packet.z) }
}

function createTelemetrySample(packet: TelemetryPacket, importedBy: TelemetrySample['importedBy']): TelemetrySample {
  return {
    ...packet,
    id: packet.packetId || `telemetry-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    receivedAt: Date.now(),
    importedBy,
  }
}

function telemetryPacketIdentity(packet: TelemetryPacket) {
  if (packet.packetId) return packet.packetId
  if (packet.sequence !== undefined && packet.stamp) return `${packet.sequence}-${packet.stamp}`
  if (packet.stamp && hasTelemetryCoordinate(packet)) return `${packet.ship || packet.grid || 'ship'}-${packet.stamp}-${packet.x}-${packet.y}-${packet.z}`
  return ''
}

function formatMetersPerSecond(value?: number) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)} m/s` : 'No speed'
}

function formatMetersPerSecondValue(value: number | null | undefined, missing = 'No packet') {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)} m/s` : missing
}

function formatMass(value?: number) {
  return Number.isFinite(value) ? `${Math.round(Number(value)).toLocaleString()} kg` : 'No mass'
}

function formatVector3(x?: number, y?: number, z?: number, unit = '') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 'No vector'
  return `${Number(x).toFixed(1)}:${Number(y).toFixed(1)}:${Number(z).toFixed(1)}${unit ? ` ${unit}` : ''}`
}

function formatVelocityVector(vector: ShipVelocityVector | null) {
  return vector ? formatVector3(vector.x, vector.y, vector.z, 'm/s') : 'No vector'
}

function formatDegrees(value: number | null | undefined) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)} deg` : 'No bearing'
}

function formatRangeRate(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 'No packet'
  const rate = Number(value)
  if (Math.abs(rate) < 0.05) return 'Range steady'
  return rate < 0 ? `Closing ${Math.abs(rate).toFixed(1)} m/s` : `Opening ${rate.toFixed(1)} m/s`
}

function velocityMagnitude(vector: ShipVelocityVector) {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function subtractVelocity(left: ShipVelocityVector, right: ShipVelocityVector): ShipVelocityVector {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  }
}

function dotVelocity(left: ShipVelocityVector, right: ShipVelocityVector) {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

function normalizeTelemetryVector(vector: ShipVelocityVector | null) {
  if (!vector) return null
  const magnitude = velocityMagnitude(vector)
  if (!Number.isFinite(magnitude) || magnitude < 0.0001) return null
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude }
}

function telemetryVectorFromKeys(
  packet: TelemetryPacket | null,
  xKey: keyof TelemetryPacket,
  yKey: keyof TelemetryPacket,
  zKey: keyof TelemetryPacket,
) {
  if (!packet) return null
  const x = coerceTelemetryNumber(packet[xKey])
  const y = coerceTelemetryNumber(packet[yKey])
  const z = coerceTelemetryNumber(packet[zKey])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x: Number(x), y: Number(y), z: Number(z) }
}

function crossVelocity(left: ShipVelocityVector, right: ShipVelocityVector): ShipVelocityVector {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  }
}

function scaleVelocity(vector: ShipVelocityVector, scalar: number): ShipVelocityVector {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar }
}

function formatAltitude(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 'NO LOCK'
  const altitude = Number(value)
  if (Math.abs(altitude) >= 10000) return `${(altitude / 1000).toFixed(1)} km`
  return `${Math.round(altitude).toLocaleString()} m`
}

function formatSignedSpeed(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 'NO VECTOR'
  const speed = Number(value)
  const sign = speed > 0.05 ? '+' : ''
  return `${sign}${speed.toFixed(1)} m/s`
}

function headingLabel(value: number | null) {
  if (!Number.isFinite(value)) return '---'
  const heading = ((Number(value) % 360) + 360) % 360
  const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8]
  return `${Math.round(heading).toString().padStart(3, '0')} / ${cardinal}`
}

function flightDirectorReading(packet: TelemetryPacket | null, currentPosition: ShipCoordinate, bodies: ShipContact[]) {
  const gravity = telemetryVectorFromKeys(packet, 'gravityX', 'gravityY', 'gravityZ')
  const forward = normalizeTelemetryVector(telemetryVectorFromKeys(packet, 'forwardX', 'forwardY', 'forwardZ'))
  const shipUp = normalizeTelemetryVector(telemetryVectorFromKeys(packet, 'upX', 'upY', 'upZ'))
  const velocity = packet ? velocityVectorFromFields(packet) : null
  const gravityMagnitude = gravity ? velocityMagnitude(gravity) : 0
  const radialUp = gravityMagnitude > 0.01 && gravity
    ? scaleVelocity(gravity, -1 / gravityMagnitude)
    : null
  const verticalSpeed = Number.isFinite(packet?.verticalSpeed)
    ? Number(packet?.verticalSpeed)
    : radialUp && velocity ? dotVelocity(velocity, radialUp) : null
  const horizontalSpeed = Number.isFinite(packet?.horizontalSpeed)
    ? Number(packet?.horizontalSpeed)
    : velocity && verticalSpeed !== null
      ? Math.sqrt(Math.max(0, velocityMagnitude(velocity) ** 2 - verticalSpeed ** 2))
      : null

  let pitchDegrees: number | null = null
  let rollDegrees: number | null = null
  let headingDegrees: number | null = null
  if (radialUp && forward) {
    pitchDegrees = Math.asin(clampNumber(dotVelocity(forward, radialUp), -1, 1)) * 180 / Math.PI
    const levelUp = normalizeTelemetryVector(subtractVelocity(radialUp, scaleVelocity(forward, dotVelocity(radialUp, forward))))
    const projectedShipUp = shipUp
      ? normalizeTelemetryVector(subtractVelocity(shipUp, scaleVelocity(forward, dotVelocity(shipUp, forward))))
      : null
    if (levelUp && projectedShipUp) {
      rollDegrees = Math.atan2(
        dotVelocity(crossVelocity(levelUp, projectedShipUp), forward),
        clampNumber(dotVelocity(levelUp, projectedShipUp), -1, 1),
      ) * 180 / Math.PI
    }

    const projectedForward = normalizeTelemetryVector(subtractVelocity(forward, scaleVelocity(radialUp, dotVelocity(forward, radialUp))))
    const worldNorth = Math.abs(radialUp.y) < 0.96 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: -1 }
    const localNorth = normalizeTelemetryVector(subtractVelocity(worldNorth, scaleVelocity(radialUp, dotVelocity(worldNorth, radialUp))))
    if (projectedForward && localNorth) {
      const localEast = normalizeTelemetryVector(crossVelocity(localNorth, radialUp))
      if (localEast) {
        headingDegrees = (Math.atan2(dotVelocity(projectedForward, localEast), dotVelocity(projectedForward, localNorth)) * 180 / Math.PI + 360) % 360
      }
    }
  }

  const planetCenter = telemetryVectorFromKeys(packet, 'planetCenterX', 'planetCenterY', 'planetCenterZ')
  const referenceCoordinate = planetCenter ?? currentPosition
  const body = nearestBodyForCoordinate(referenceCoordinate, bodies)
  const surfaceAltitude = Number.isFinite(packet?.surfaceAltitude) ? Number(packet?.surfaceAltitude) : null
  const seaLevelAltitude = Number.isFinite(packet?.seaLevelAltitude) ? Number(packet?.seaLevelAltitude) : null
  const descentRate = verticalSpeed === null ? null : Math.max(0, -verticalSpeed)
  const timeToSurfaceSeconds = surfaceAltitude !== null && descentRate !== null && descentRate > 0.1
    ? surfaceAltitude / descentRate
    : null
  const descentAngle = descentRate !== null && horizontalSpeed !== null
    ? Math.atan2(descentRate, Math.max(0.01, horizontalSpeed)) * 180 / Math.PI
    : null

  let state: 'offline' | 'nominal' | 'caution' | 'critical' = surfaceAltitude === null || !radialUp ? 'offline' : 'nominal'
  let status = state === 'offline' ? 'NO PLANET LOCK' : verticalSpeed !== null && verticalSpeed > 1 ? 'ASCENT PROFILE' : 'PLANETARY FLIGHT'
  if (surfaceAltitude !== null && descentRate !== null) {
    if ((surfaceAltitude < 250 && descentRate > 5) || (surfaceAltitude < 1000 && descentRate > 20)) {
      state = 'critical'
      status = 'PULL UP / ARREST DESCENT'
    } else if ((surfaceAltitude < 1000 && descentRate > 8) || (surfaceAltitude < 5000 && descentRate > 25)) {
      state = 'caution'
      status = 'DESCENT RATE HIGH'
    } else if (descentRate > 0.1) {
      status = surfaceAltitude < 5000 ? 'LANDING PROFILE' : 'DESCENT PROFILE'
    }
  }

  return {
    body,
    surfaceAltitude,
    seaLevelAltitude,
    verticalSpeed,
    horizontalSpeed,
    pitchDegrees,
    rollDegrees,
    headingDegrees,
    descentAngle,
    timeToSurfaceSeconds,
    state,
    status,
    gravityG: Number.isFinite(packet?.naturalGravity) ? Number(packet?.naturalGravity) : gravityMagnitude > 0 ? gravityMagnitude / 9.81 : null,
  }
}

function terrainClearanceColor(clearance: number, speed: number) {
  const criticalFloor = 45 + speed * 1.2
  const cautionFloor = 120 + speed * 2.5
  if (clearance <= criticalFloor) return '#ff4f4f'
  if (clearance <= cautionFloor) return '#f6b94d'
  return '#80ffad'
}

function ShipTerrainScan({ packet, surfaceAltitude }: { packet: TelemetryPacket | null; surfaceAltitude: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveSamples = useMemo(() => packet?.terrainScan ?? [], [packet?.terrainScan])
  const hasLiveScan = liveSamples.length >= 5
  const scanStatus = packet?.terrainScanStatus ?? (packet?.terrainScanSource ? 'standby' : 'unavailable')
  const scanRange = Number.isFinite(packet?.terrainScanRange)
    ? Math.max(100, Number(packet?.terrainScanRange))
    : 1600
  const scanWidth = Number.isFinite(packet?.terrainScanWidth)
    ? Math.max(100, Number(packet?.terrainScanWidth))
    : 1000
  const speed = Number.isFinite(packet?.speed) ? Math.max(0, Number(packet?.speed)) : 0
  const samples = useMemo(() => {
    if (hasLiveScan) return liveSamples
    const aheadRows = [0, 200, 450, 800, 1200, 1600]
    const fallbackClearance = surfaceAltitude ?? 0
    return aheadRows.flatMap((ahead, row) => {
      const halfWidth = 50 + ahead * 0.28
      return [-1, -0.5, 0, 0.5, 1].map((lateralFactor, column) => ({
        row,
        column,
        ahead,
        lateral: halfWidth * lateralFactor,
        clearance: fallbackClearance,
        surfaceDelta: 0,
      }))
    })
  }, [hasLiveScan, liveSamples, surfaceAltitude])
  const minimumSample = hasLiveScan
    ? liveSamples.reduce<TerrainScanSample | null>((minimum, sample) => (
      !minimum || sample.clearance < minimum.clearance ? sample : minimum
    ), null)
    : null
  const minimumClearance = minimumSample?.clearance ?? surfaceAltitude
  const peakRise = hasLiveScan ? Math.max(...liveSamples.map((sample) => sample.surfaceDelta)) : null
  const cautionFloor = 120 + speed * 2.5
  const criticalFloor = 45 + speed * 1.2
  const scanState = minimumClearance === null
    ? 'offline'
    : minimumClearance <= criticalFloor
      ? 'critical'
      : minimumClearance <= cautionFloor
        ? 'caution'
        : 'clear'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(240, Math.round(rect.width || 720))
      const height = Math.max(180, Math.round(rect.height || 250))
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
      const targetWidth = Math.round(width * pixelRatio)
      const targetHeight = Math.round(height * pixelRatio)
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#010504'
      context.fillRect(0, 0, width, height)

      const plotTop = 34
      const plotBottom = height - 31
      const plotHeight = plotBottom - plotTop
      const centerX = width / 2
      const halfPlotWidth = width * 0.46
      const maxAhead = Math.max(scanRange, ...samples.map((sample) => sample.ahead), 1)
      const halfScanWidth = Math.max(scanWidth / 2, ...samples.map((sample) => Math.abs(sample.lateral)), 1)
      const reliefLimit = Math.max(250, Math.abs(peakRise ?? 0), surfaceAltitude ?? 0)
      const reliefScale = Math.min(0.16, Math.max(0.035, 48 / reliefLimit))
      const project = (sample: TerrainScanSample) => ({
        x: centerX + sample.lateral / halfScanWidth * halfPlotWidth,
        y: plotBottom - sample.ahead / maxAhead * plotHeight - sample.surfaceDelta * reliefScale,
      })

      context.lineWidth = 1
      context.strokeStyle = hasLiveScan ? 'rgba(85, 211, 132, 0.22)' : 'rgba(125, 232, 210, 0.13)'
      for (let row = 0; row <= 5; row += 1) {
        const ratio = row / 5
        const y = plotBottom - ratio * plotHeight
        const halfWidth = 30 + ratio * (halfPlotWidth - 30)
        context.beginPath()
        context.moveTo(centerX - halfWidth, y)
        context.lineTo(centerX + halfWidth, y)
        context.stroke()
      }
      for (const ratio of [-1, -0.5, 0, 0.5, 1]) {
        context.beginPath()
        context.moveTo(centerX + ratio * 30, plotBottom)
        context.lineTo(centerX + ratio * halfPlotWidth, plotTop)
        context.stroke()
      }

      const byRow = new Map<number, TerrainScanSample[]>()
      samples.forEach((sample) => {
        const row = byRow.get(sample.row) ?? []
        row.push(sample)
        byRow.set(sample.row, row)
      })
      const orderedRows = [...byRow.entries()].sort(([left], [right]) => left - right)
      const byColumn = new Map<number, TerrainScanSample[]>()
      samples.forEach((sample) => {
        const column = byColumn.get(sample.column) ?? []
        column.push(sample)
        byColumn.set(sample.column, column)
      })

      context.lineWidth = hasLiveScan ? 1.5 : 1
      orderedRows.forEach(([, rowSamples]) => {
        const ordered = [...rowSamples].sort((left, right) => left.column - right.column)
        for (let index = 1; index < ordered.length; index += 1) {
          const previous = ordered[index - 1]
          const current = ordered[index]
          const from = project(previous)
          const to = project(current)
          context.strokeStyle = hasLiveScan
            ? terrainClearanceColor(Math.min(previous.clearance, current.clearance), speed)
            : 'rgba(125, 232, 210, 0.22)'
          context.beginPath()
          context.moveTo(from.x, from.y)
          context.lineTo(to.x, to.y)
          context.stroke()
        }
      })
      byColumn.forEach((columnSamples) => {
        const ordered = [...columnSamples].sort((left, right) => left.row - right.row)
        for (let index = 1; index < ordered.length; index += 1) {
          const previous = ordered[index - 1]
          const current = ordered[index]
          const from = project(previous)
          const to = project(current)
          context.strokeStyle = hasLiveScan
            ? terrainClearanceColor(Math.min(previous.clearance, current.clearance), speed)
            : 'rgba(125, 232, 210, 0.18)'
          context.beginPath()
          context.moveTo(from.x, from.y)
          context.lineTo(to.x, to.y)
          context.stroke()
        }
      })

      samples.forEach((sample) => {
        const point = project(sample)
        context.fillStyle = hasLiveScan ? terrainClearanceColor(sample.clearance, speed) : '#346a5c'
        context.fillRect(point.x - 2, point.y - 2, 4, 4)
      })

      context.strokeStyle = '#f1e2c6'
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(centerX - 22, plotBottom + 5)
      context.lineTo(centerX - 6, plotBottom + 5)
      context.lineTo(centerX, plotBottom - 2)
      context.lineTo(centerX + 6, plotBottom + 5)
      context.lineTo(centerX + 22, plotBottom + 5)
      context.stroke()

      context.font = '10px "IBM Plex Mono", "Share Tech Mono", monospace'
      context.fillStyle = '#7de8d2'
      context.fillText(`0`, 8, plotBottom + 4)
      context.fillText(`${Math.round(maxAhead)} M`, 8, plotTop + 4)
      context.textAlign = 'right'
      context.fillText(hasLiveScan ? 'VOXEL RETURN' : 'AGL FALLBACK', width - 8, 15)
      context.textAlign = 'left'

      if (hasLiveScan) {
        const sweepY = plotTop + ((Date.now() / 35) % Math.max(1, plotHeight))
        context.strokeStyle = 'rgba(128, 255, 173, 0.34)'
        context.beginPath()
        context.moveTo(centerX - halfPlotWidth, sweepY)
        context.lineTo(centerX + halfPlotWidth, sweepY)
        context.stroke()
      }

      context.strokeStyle = 'rgba(125, 232, 210, 0.36)'
      context.strokeRect(0.5, 0.5, width - 1, height - 1)
    }

    draw()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw)
    resizeObserver?.observe(canvas)
    return () => resizeObserver?.disconnect()
  }, [hasLiveScan, peakRise, samples, scanRange, scanWidth, speed, surfaceAltitude])

  return (
    <div className={`shipOsTerrainScan shipOsTerrainScan-${scanState}`}>
      <header>
        <div><span>Synthetic FLIR / Terrain Scan</span><strong>{hasLiveScan ? 'FORWARD VOXEL MESH' : 'SINGLE-BEAM AGL'}</strong></div>
        <small>{hasLiveScan
          ? `${liveSamples.length} returns / ${Math.round(scanRange).toLocaleString()} m fan`
          : scanStatus === 'standby-high-altitude'
            ? 'Scan standby above 12 km AGL'
            : packet?.terrainScanSource
              ? `Scan ${scanStatus.replaceAll('-', ' ')}`
              : 'Install the current local telemetry mod for terrain returns'}</small>
      </header>
      <canvas
        ref={canvasRef}
        aria-label={`Forward terrain scan. ${hasLiveScan ? `${liveSamples.length} sampled terrain returns` : 'Surface altitude fallback only'}. Minimum clearance ${formatAltitude(minimumClearance)}.`}
        role="img"
      />
      <dl>
        <div><dt>Minimum Clearance</dt><dd>{formatAltitude(minimumClearance)}</dd></div>
        <div><dt>Peak Rise</dt><dd>{peakRise === null ? 'NO MESH' : formatAltitude(peakRise)}</dd></div>
        <div><dt>Closest Hazard</dt><dd>{minimumSample ? `${Math.round(minimumSample.ahead).toLocaleString()} m ahead` : 'NO RETURN'}</dd></div>
        <div><dt>Clearance State</dt><dd>{scanState.toUpperCase()}</dd></div>
      </dl>
      <p>Sampled elevation display, not thermal imagery. Red and amber returns indicate speed-adjusted terrain clearance; it is advisory and does not command the ship.</p>
    </div>
  )
}

function ShipFlightDirector({
  packet,
  currentPosition,
  bodies,
}: {
  packet: TelemetryPacket | null
  currentPosition: ShipCoordinate
  bodies: ShipContact[]
}) {
  const reading = flightDirectorReading(packet, currentPosition, bodies)
  const terrainMinimum = packet?.terrainScan?.length
    ? Math.min(...packet.terrainScan.map((sample) => sample.clearance))
    : null
  const terrainSpeed = Number.isFinite(packet?.speed) ? Math.max(0, Number(packet?.speed)) : 0
  const terrainCritical = terrainMinimum !== null && terrainMinimum <= 45 + terrainSpeed * 1.2
  const terrainCaution = terrainMinimum !== null && terrainMinimum <= 120 + terrainSpeed * 2.5
  const directorState = terrainCritical ? 'critical' : terrainCaution && reading.state !== 'critical' ? 'caution' : reading.state
  const directorStatus = terrainCritical ? 'TERRAIN / PULL UP' : terrainCaution ? 'TERRAIN AHEAD' : reading.status
  const pitch = reading.pitchDegrees ?? 0
  const roll = reading.rollDegrees ?? 0
  const horizonTransform = `translateY(${clampNumber(pitch, -40, 40) * 2}px) rotate(${-clampNumber(roll, -90, 90)}deg)`
  const timeToSurface = reading.timeToSurfaceSeconds === null
    ? reading.verticalSpeed !== null && reading.verticalSpeed >= 0 ? 'OPENING' : 'NO CLOSURE'
    : reading.timeToSurfaceSeconds < 120
      ? `${Math.max(0, Math.round(reading.timeToSurfaceSeconds))} sec`
      : `${(reading.timeToSurfaceSeconds / 60).toFixed(1)} min`

  return (
    <section className={`shipOsFlightDirector shipOsFlightDirector-${directorState}`} aria-label="Intrepid planetary flight director">
      <header>
        <div>
          <span>Intrepid Flight Director</span>
          <strong>{directorStatus}</strong>
        </div>
        <small>{reading.surfaceAltitude === null ? 'Awaiting controller elevation telemetry' : `${reading.body.name} gravity reference / ${packet?.source || 'telemetry'}`}</small>
      </header>
      <div className="shipOsFlightDirectorGrid">
        <div className="shipOsArtificialHorizon" role="img" aria-label={`Artificial horizon. Pitch ${formatDegrees(reading.pitchDegrees)}, roll ${formatDegrees(reading.rollDegrees)}, heading ${headingLabel(reading.headingDegrees)}.`}>
          <div className="shipOsHorizonMoving" style={{ transform: horizonTransform }}>
            <div className="shipOsHorizonSky" />
            <div className="shipOsHorizonGround" />
            <div className="shipOsHorizonLine" />
            {[-30, -20, -10, 10, 20, 30].map((mark) => (
              <i key={mark} className="shipOsPitchMark" style={{ top: `calc(50% + ${mark * 2}px)` }}><span>{Math.abs(mark)}</span></i>
            ))}
          </div>
          <div className="shipOsHorizonBankIndex" aria-hidden="true" />
          <div className="shipOsHorizonAircraft" aria-hidden="true"><i /><b /><i /></div>
          <div className="shipOsHorizonReadout shipOsHorizonPitch">PITCH {formatDegrees(reading.pitchDegrees)}</div>
          <div className="shipOsHorizonReadout shipOsHorizonRoll">ROLL {formatDegrees(reading.rollDegrees)}</div>
          <div className="shipOsHorizonHeading">HDG {headingLabel(reading.headingDegrees)}</div>
        </div>
        <dl className="shipOsLandingTelemetry">
          <div className="primary"><dt>Radar Altitude / AGL</dt><dd>{formatAltitude(reading.surfaceAltitude)}</dd></div>
          <div><dt>Sea-Level Altitude</dt><dd>{formatAltitude(reading.seaLevelAltitude)}</dd></div>
          <div><dt>Vertical Speed</dt><dd>{formatSignedSpeed(reading.verticalSpeed)}</dd></div>
          <div><dt>Horizontal Speed</dt><dd>{formatMetersPerSecondValue(reading.horizontalSpeed, 'NO VECTOR')}</dd></div>
          <div><dt>Gravity</dt><dd>{reading.gravityG === null ? 'NO LOCK' : `${reading.gravityG.toFixed(2)} g`}</dd></div>
          <div><dt>Descent Angle</dt><dd>{reading.descentAngle === null ? 'NO DESCENT' : `${reading.descentAngle.toFixed(1)} deg`}</dd></div>
          <div><dt>Time to Terrain</dt><dd>{timeToSurface}</dd></div>
          <div><dt>Dampeners</dt><dd>{formatTelemetryFlag(packet?.dampeners, 'ON', 'OFF')}</dd></div>
        </dl>
      </div>
      <ShipTerrainScan packet={packet} surfaceAltitude={reading.surfaceAltitude} />
      <p>Radar altitude is the game HUD surface elevation from the active cockpit or remote control. Time-to-terrain is a straight-line closure estimate, not an autopilot or terrain-following guarantee.</p>
    </section>
  )
}

function velocityVectorFromFields(fields: {
  velocityX?: unknown
  velocityY?: unknown
  velocityZ?: unknown
  vx?: unknown
  vy?: unknown
  vz?: unknown
}) {
  const x = coerceTelemetryNumber(fields.velocityX ?? fields.vx)
  const y = coerceTelemetryNumber(fields.velocityY ?? fields.vy)
  const z = coerceTelemetryNumber(fields.velocityZ ?? fields.vz)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x: Number(x), y: Number(y), z: Number(z) }
}

function motionVectorForContact(contact: ShipContact): { vector: ShipVelocityVector | null; source: string } {
  const liveVector = velocityVectorFromFields(contact)
  if (liveVector) return { vector: liveVector, source: 'Live vector' }
  if (['body', 'relay', 'gps', 'waypoint', 'custom', 'asteroid', 'station'].includes(contact.kind)) {
    return { vector: { x: 0, y: 0, z: 0 }, source: 'Assumed fixed' }
  }
  return { vector: null, source: 'No motion packet' }
}

function speedForMotion(vector: ShipVelocityVector | null, reportedSpeed?: number) {
  if (Number.isFinite(reportedSpeed)) return Number(reportedSpeed)
  return vector ? velocityMagnitude(vector) : null
}

function bearingFromRelativePosition(contact: ShipCoordinate, currentPosition: ShipCoordinate) {
  const dx = contact.x - currentPosition.x
  const dy = contact.y - currentPosition.y
  const dz = contact.z - currentPosition.z
  const planar = Math.hypot(dx, dz)
  const distance = Math.hypot(dx, dy, dz)
  if (distance < 0.001) return { bearingDegrees: null, elevationDegrees: null, unit: null as ShipVelocityVector | null }
  const bearingDegrees = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360
  const elevationDegrees = Math.atan2(dy, planar) * 180 / Math.PI
  return {
    bearingDegrees,
    elevationDegrees,
    unit: { x: dx / distance, y: dy / distance, z: dz / distance },
  }
}

function formatTelemetryFlag(value: boolean | undefined, active: string, inactive: string, missing = 'No packet') {
  if (typeof value !== 'boolean') return missing
  return value ? active : inactive
}

function normalizeBridgePollSeconds(value?: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 5
  return Math.max(2, Math.min(120, Math.round(parsed)))
}

function bridgeHealthEndpoint(endpoint: string) {
  if (endpoint.startsWith('/api/shipos/telemetry')) return cloudBridgeHealthEndpoint
  try {
    const url = new URL(endpoint)
    url.pathname = '/health'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return 'http://127.0.0.1:8795/health'
  }
}

function bridgeTelemetryEndpointFromHealth(endpoint: string) {
  if (endpoint.startsWith('/api/shipos/telemetry')) return cloudBridgeEndpoint
  try {
    const url = new URL(endpoint)
    url.pathname = '/telemetry/latest'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return defaultBridgeEndpoint
  }
}

async function fetchJsonWithTimeout(endpoint: string, accessToken = '', timeoutMs = 8000) {
  const abortController = new AbortController()
  const timeout = window.setTimeout(() => abortController.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      mode: 'cors',
      signal: abortController.signal,
    })
    if (!response.ok) throw new Error(`Bridge returned HTTP ${response.status}.`)
    return await response.json()
  } finally {
    window.clearTimeout(timeout)
  }
}

function bridgeEndpointCandidates(endpoint: string, health = false) {
  const configuredEndpoint = endpoint.trim()
  const candidates = configuredEndpoint.startsWith('/api/shipos/telemetry')
    ? [configuredEndpoint]
    : [configuredEndpoint, ...fallbackBridgeEndpoints].filter(Boolean)
  const unique = Array.from(new Set(candidates))
  return health ? unique.map(bridgeHealthEndpoint) : unique
}

function telemetryPacketAge(stamp?: string) {
  if (!stamp) return null
  const packetTime = Date.parse(stamp)
  if (!Number.isFinite(packetTime)) return null
  return Math.max(0, Date.now() - packetTime)
}

function telemetryPacketAgeLabel(stamp?: string) {
  const age = telemetryPacketAge(stamp)
  if (age === null) return 'Unknown'
  const seconds = Math.floor(age / 1000)
  if (seconds < 15) return 'Live'
  if (seconds < 120) return `${seconds}s old`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 120) return `${minutes}m old`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h old`
  return `${Math.floor(hours / 24)}d old`
}

function bridgePacketStatus(stamp: string | undefined, didImport: boolean) {
  const age = telemetryPacketAge(stamp)
  if (age !== null && age > 30000) return 'Relay online, game packet stale'
  return didImport ? 'Live packet received' : 'Bridge steady, no new packet'
}

function bridgeFetchErrorMessage(error: unknown, endpoint: string) {
  if (error instanceof DOMException && error.name === 'AbortError') return `Bridge request timed out at ${endpoint}.`
  if (error instanceof TypeError) {
    return endpoint.startsWith('/api/shipos/telemetry')
      ? 'Browser could not reach the EchoBoard telemetry relay.'
      : `Browser could not load ${endpoint}. Local endpoints work on the Space Engineers PC; other devices should use the EchoBoard relay.`
  }
  if (error instanceof Error) return error.message
  return `Bridge request failed at ${endpoint}.`
}

async function fetchBridgeWithFallback(endpoint: string, health = false, accessToken = '') {
  const attempts: string[] = []
  for (const candidate of bridgeEndpointCandidates(endpoint, health)) {
    try {
      return {
        endpoint: candidate,
        payload: await fetchJsonWithTimeout(candidate, accessToken),
        attempts,
      }
    } catch (error) {
      attempts.push(bridgeFetchErrorMessage(error, candidate))
    }
  }
  throw new Error(attempts.join(' | ') || 'Bridge request failed.')
}

function buildTelemetryAlerts(packet: TelemetryPacket | null, history: TelemetrySample[]) {
  const alerts: { level: 'Watch' | 'Caution' | 'Critical'; label: string; detail: string }[] = []
  if (!packet) return alerts

  const checks = [
    { key: 'hydrogenPercent' as const, label: 'Hydrogen reserve', caution: 35, critical: 18 },
    { key: 'oxygenPercent' as const, label: 'Oxygen reserve', caution: 35, critical: 18 },
    { key: 'batteryPercent' as const, label: 'Battery charge', caution: 28, critical: 12 },
    { key: 'jumpPercent' as const, label: 'Jump charge', caution: 25, critical: 8 },
  ]

  checks.forEach((check) => {
    const value = clampPercent(packet[check.key])
    if (value === null) return
    if (value <= check.critical) alerts.push({ level: 'Critical', label: check.label, detail: `${value.toFixed(1)}% remaining` })
    else if (value <= check.caution) alerts.push({ level: 'Caution', label: check.label, detail: `${value.toFixed(1)}% remaining` })
  })

  const cargoPercent = clampPercent(packet.cargoPercent)
  if (cargoPercent !== null && cargoPercent >= 92) alerts.push({ level: 'Caution', label: 'Cargo capacity', detail: `${cargoPercent.toFixed(1)}% full` })
  if (Number.isFinite(packet.speed) && Number(packet.speed) > 95) alerts.push({ level: 'Watch', label: 'Velocity envelope', detail: `${Number(packet.speed).toFixed(1)} m/s` })
  if (Number.isFinite(packet.nonFunctionalBlockCount) && Number(packet.nonFunctionalBlockCount) > 0) {
    alerts.push({ level: 'Critical', label: 'Block damage', detail: `${Number(packet.nonFunctionalBlockCount).toLocaleString()} non-functional blocks` })
  }
  if (Number.isFinite(packet.notWorkingBlockCount) && Number(packet.notWorkingBlockCount) > 0) {
    alerts.push({ level: 'Caution', label: 'Offline systems', detail: `${Number(packet.notWorkingBlockCount).toLocaleString()} blocks not working` })
  }
  if (Number.isFinite(packet.naturalGravity) && Number(packet.naturalGravity) > 0.4 && Number.isFinite(packet.speed) && Number(packet.speed) > 80) {
    alerts.push({ level: 'Watch', label: 'Gravity maneuver', detail: `${Number(packet.naturalGravity).toFixed(2)} g at ${Number(packet.speed).toFixed(1)} m/s` })
  }
  if (history.length >= 2) {
    const latest = coordinateFromTelemetry(history[0])
    const prior = coordinateFromTelemetry(history[1])
    if (latest && prior && distanceMeters(latest, prior) > 250000) {
      alerts.push({ level: 'Watch', label: 'Position jump', detail: `${formatKm(distanceMeters(latest, prior))} since last packet` })
    }
  }

  return alerts
}

function telemetryPathDistance(history: TelemetrySample[]) {
  const coordinates = history.map(coordinateFromTelemetry).filter(Boolean) as ShipCoordinate[]
  return coordinates.slice(1).reduce((total, coordinate, index) => total + distanceMeters(coordinates[index], coordinate), 0)
}

function formatDurationFromSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'No estimate'
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 90) return `${minutes.toLocaleString()} min`
  const hours = minutes / 60
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: hours >= 10 ? 0 : 1 })} hr`
}

function nearestBodyForCoordinate(coordinate: ShipCoordinate, bodies: ShipContact[] = starSystemBodies) {
  return bodies
    .map((body) => ({ body, distance: distanceMeters(coordinate, body) }))
    .sort((left, right) => left.distance - right.distance)[0]?.body ?? bodies[0] ?? starSystemBodies[0]
}

function locationRecordFromContact(contact: ShipContact, bodies: ShipContact[] = starSystemBodies): LocationRecord {
  const nearestBody = contact.kind === 'body' ? contact : nearestBodyForCoordinate(contact, bodies)
  const isBody = contact.kind === 'body'
  return {
    id: `loc-${contact.id}`,
    contactId: contact.id,
    name: contact.name,
    body: nearestBody.name,
    className: contact.className,
    knowledgeState: isBody ? 'SURVEYED' : contact.kind === 'signal' || contact.kind === 'radar' ? 'DETECTED' : 'OBSERVED',
    confidence: contact.kind === 'signal' || contact.kind === 'radar' ? 'PROBABLE' : 'CONFIRMED',
    x: contact.x,
    y: contact.y,
    z: contact.z,
    altitude: isBody ? 'Planetary datum' : 'Unmeasured',
    gravity: isBody ? 'Gravity well cataloged' : 'Unknown',
    atmosphere: isBody ? 'Planetary profile pending detail' : 'Unknown',
    landingSuitability: contact.kind === 'station' ? 'Docking/approach record exists' : isBody ? 'Requires local LZ record' : 'Not assessed',
    approachNotes: contact.notes,
    hazards: contact.status,
    previousVisits: [],
    knownRoutes: [],
    pilotAnnotations: '',
    whyHere: contact.kind === 'asteroid' ? 'Sensor return / resource candidate.' : contact.notes || 'Imported contact requiring operational context.',
    relatedJobIds: [],
    relatedEntityIds: [],
    updatedAt: Date.now(),
  }
}

function linkedLocationIdsForJob(job: JobRecord, locations: LocationRecord[]) {
  const haystack = `${job.title} ${job.client} ${job.route} ${job.destination} ${job.notes}`.toLowerCase()
  return locations
    .filter((location) => haystack.includes(location.name.toLowerCase()) || haystack.includes(location.body.toLowerCase()))
    .map((location) => location.id)
}

function linkedEntityIdsForJob(job: JobRecord, entities: DirectoryEntity[]) {
  const haystack = `${job.title} ${job.client} ${job.route} ${job.destination} ${job.notes}`.toLowerCase()
  return entities
    .filter((entity) => haystack.includes(entity.name.toLowerCase()) || haystack.includes(entity.role.toLowerCase()))
    .map((entity) => entity.id)
}

function createDefaultNavigationPlan(): NavigationPlanDraft {
  return {
    destinationId: 'body-europa',
    cruiseSpeed: '100',
    fuelReserve: '30',
    notes: 'Ares -> Europa. Three-day layover for Sato delivery, post-refit inspection, liberty, local familiarization, and ordinary commercial work; Pelagos follows.',
  }
}

function createDefaultBridgeConfig(): BridgeConfig {
  return {
    endpoint: defaultBridgeEndpoint,
    status: 'Manual import mode',
    autoPoll: false,
    pollSeconds: 5,
    consecutiveFailures: 0,
  }
}

function contactMatchIndex(contact: ShipContact, text: string) {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return Number.POSITIVE_INFINITY
  const name = contact.name.toLowerCase()
  const className = contact.className.toLowerCase()
  const nameIndex = normalized.indexOf(name)
  if (nameIndex >= 0) return nameIndex
  const classIndex = normalized.indexOf(className)
  if (classIndex >= 0) return classIndex + 500
  if (name.includes(normalized)) return 0
  return Number.POSITIVE_INFINITY
}

function findBestContactInText(contacts: ShipContact[], text: string) {
  return contacts
    .map((contact, order) => ({ contact, score: contactMatchIndex(contact, text), order }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score || left.order - right.order)[0]?.contact ?? null
}

function findJobDestinationContact(contacts: ShipContact[], job: JobRecord) {
  return findBestContactInText(contacts, job.destination)
    ?? findBestContactInText(contacts, job.route)
}

function findJobOriginContact(contacts: ShipContact[], job: JobRecord) {
  const routeStart = job.route.split(/\s*(?:->|=>|→)\s*/)[0] ?? job.route
  return findBestContactInText(contacts, routeStart)
}

function flightRouteColor(job: JobRecord, index: number) {
  if (/medical|patient|critical/i.test(`${job.title} ${job.client} ${job.notes}`)) return '#ffbf6e'
  if (/passenger|manifest|boarding/i.test(`${job.title} ${job.client} ${job.notes}`)) return '#7de8d2'
  if (job.status === 'Prospect') return '#8fb4ff'
  if (job.status === 'In Transit') return '#75d69d'
  return ['#f6b94d', '#d68ebd', '#63d7ff'][index % 3]
}

function uniqueRoutePoints(points: FlightRoutePoint[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1]
    if (!previous) return true
    return previous.label !== point.label || distanceMeters(previous.coordinate, point.coordinate) > 100
  })
}

function routePointDistance(points: FlightRoutePoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index].coordinate, point.coordinate), 0)
}

function buildFlightRoutePlan(
  job: JobRecord,
  contacts: ShipContact[],
  currentPosition: ShipCoordinate,
  cruiseSpeed: number,
  passengerCount: number,
  index: number,
): FlightRoutePlan | null {
  const destination = findJobDestinationContact(contacts, job)
  if (!destination) return null
  const origin = findJobOriginContact(contacts, job)
  const routeMentionsShip = /\b(dsv\s+intrepid|intrepid|ship)\b/i.test(job.route)
  const rawPoints: FlightRoutePoint[] = []
  if (origin && origin.id !== destination.id) {
    rawPoints.push({ label: origin.name, coordinate: origin, contact: origin })
  }
  if (routeMentionsShip || !origin) {
    rawPoints.push({ label: shipName, coordinate: currentPosition })
  }
  rawPoints.push({ label: destination.name, coordinate: destination, contact: destination })
  const points = uniqueRoutePoints(rawPoints)
  if (points.length < 2) return null
  const distance = routePointDistance(points)
  return {
    id: job.id,
    label: job.title,
    status: job.status,
    color: flightRouteColor(job, index),
    points,
    pointLabels: points.map((point) => point.label),
    destinationName: destination.name,
    distanceMeters: distance,
    eta: formatDurationFromSeconds(distance / cruiseSpeed),
    passengerCount,
  }
}

function parseBridgePacket(payload: unknown): TelemetryPacket {
  if (Array.isArray(payload)) {
    const latest = [...payload].reverse().find((item) => item && typeof item === 'object')
    if (!latest) throw new Error('Bridge returned an empty telemetry list.')
    return normalizeTelemetryPacket(latest as Record<string, unknown>)
  }
  if (!payload || typeof payload !== 'object') throw new Error('Bridge response must be a telemetry object or list.')
  const bridgePayload = payload as Record<string, unknown>
  if (bridgePayload.packet && typeof bridgePayload.packet === 'object') return normalizeTelemetryPacket(bridgePayload.packet as Record<string, unknown>)
  if (bridgePayload.latest && typeof bridgePayload.latest === 'object') return normalizeTelemetryPacket(bridgePayload.latest as Record<string, unknown>)
  return normalizeTelemetryPacket(bridgePayload)
}

function blueprintBlockCategory(type: string): BlueprintBlockCategory {
  const normalized = type.toLowerCase()
  if (normalized.includes('thrust') || normalized.includes('engine')) return 'propulsion'
  if (normalized.includes('battery') || normalized.includes('reactor') || normalized.includes('solar') || normalized.includes('hydrogenengine')) return 'power'
  if (normalized.includes('cargo') || normalized.includes('container') || normalized.includes('connector') || normalized.includes('collector')) return 'cargo'
  if (normalized.includes('cockpit') || normalized.includes('flightseat') || normalized.includes('remotecontrol') || normalized.includes('programmable') || normalized.includes('button')) return 'control'
  if (normalized.includes('turret') || normalized.includes('gun') || normalized.includes('launcher') || normalized.includes('missile')) return 'weapon'
  if (normalized.includes('oxygen') || normalized.includes('hydrogen') || normalized.includes('vent') || normalized.includes('medical') || normalized.includes('survival')) return 'life'
  if (normalized.includes('bed') || normalized.includes('kitchen') || normalized.includes('locker') || normalized.includes('shower') || normalized.includes('desk') || normalized.includes('viewport')) return 'interior'
  if (normalized.includes('armor') || normalized.includes('slope') || normalized.includes('corner') || normalized.includes('truss')) return 'armor'
  return 'utility'
}

function blueprintBlockShape(type: string): BlueprintBlockShape {
  const normalized = type.toLowerCase()
  if (normalized.includes('truss') || normalized.includes('catwalk')) return 'truss'
  if (normalized.includes('slope') || normalized.includes('ramp')) return 'slope'
  if (normalized.includes('corner')) return 'corner'
  if (normalized.includes('window') || normalized.includes('viewport') || normalized.includes('door') || normalized.includes('light') || normalized.includes('panel') || normalized.includes('locker') || normalized.includes('bed') || normalized.includes('desk')) return 'thin'
  return 'cube'
}

function blueprintBlockFootprint(type: string): BlueprintBlockFootprint {
  const normalized = type.toLowerCase()
  if (normalized.includes('largeblockprototechthruster') || normalized.includes('prototechthruster')) return { sizeX: 3, sizeY: 3, sizeZ: 2 }
  if (normalized.includes('largeblocklargeflatatmosphericthrust') || normalized.includes('largeflatatmosphericthrust')) return { sizeX: 3, sizeY: 1, sizeZ: 3 }
  return { sizeX: 1, sizeY: 1, sizeZ: 1 }
}

function sanitizeFootprintSize(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function blueprintFootprintForBlock(block: BlueprintModelBlock): BlueprintBlockFootprint {
  const fallback = blueprintBlockFootprint(block.subtype)
  return {
    sizeX: sanitizeFootprintSize(block.sizeX, fallback.sizeX),
    sizeY: sanitizeFootprintSize(block.sizeY, fallback.sizeY),
    sizeZ: sanitizeFootprintSize(block.sizeZ, fallback.sizeZ),
  }
}

function blueprintCategoryColor(category: BlueprintBlockCategory) {
  const colors: Record<BlueprintBlockCategory, string> = {
    armor: '#88949a',
    propulsion: '#f6b94d',
    power: '#ffe06f',
    cargo: '#7db7e8',
    control: '#7de8d2',
    weapon: '#ff6b61',
    life: '#8fe07a',
    utility: '#c9b89e',
    interior: '#b79df2',
  }
  return colors[category]
}

function orientationForBlock(element: Element) {
  const orientation = element.querySelector('BlockOrientation')
  return {
    forward: orientation?.getAttribute('Forward') || 'Forward',
    up: orientation?.getAttribute('Up') || 'Up',
  }
}

function elementPosition(element: Element): ShipCoordinate | null {
  const min = element.querySelector('Min')
  if (!min) return null
  const x = Number(min.getAttribute('x'))
  const y = Number(min.getAttribute('y'))
  const z = Number(min.getAttribute('z'))
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x, y, z }
}

function boundsForBlocks(blocks: BlueprintModelBlock[], includeFootprints = false): BlueprintBounds {
  return blocks.reduce<BlueprintBounds>((bounds, block) => {
    const footprint = includeFootprints ? blueprintFootprintForBlock(block) : { sizeX: 1, sizeY: 1, sizeZ: 1 }
    const halfX = (footprint.sizeX - 1) / 2
    const halfY = (footprint.sizeY - 1) / 2
    const halfZ = (footprint.sizeZ - 1) / 2
    return {
      minX: Math.min(bounds.minX, block.x - halfX),
      maxX: Math.max(bounds.maxX, block.x + halfX),
      minY: Math.min(bounds.minY, block.y - halfY),
      maxY: Math.max(bounds.maxY, block.y + halfY),
      minZ: Math.min(bounds.minZ, block.z - halfZ),
      maxZ: Math.max(bounds.maxZ, block.z + halfZ),
    }
  }, {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  })
}

function normalizeBounds(bounds: BlueprintBounds): BlueprintBounds {
  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
  }
  return bounds
}

function parseBlueprintSnapshot(text: string, fileName: string): BlueprintSnapshot {
  const normalizedText = text.includes('xmlns:xsi') ? text : text.replace(/xsi:/g, 'xsi_')
  const parser = new DOMParser()
  const document = parser.parseFromString(normalizedText, 'text/xml')
  if (document.querySelector('parsererror')) throw new Error('Blueprint XML could not be parsed.')

  const elements = Array.from(document.getElementsByTagName('*'))
  const gridElements = elements.filter((element) => /CubeGrid$/i.test(element.tagName))
  const blockElements = elements.filter((element) => element.parentElement && /CubeBlocks$/i.test(element.parentElement.tagName))
  const readText = (selector: string) => document.querySelector(selector)?.textContent?.trim() || ''
  const typeForBlock = (element: Element) => [
    element.getAttribute('xsi:type'),
    element.getAttribute('xsi_type'),
    element.getAttribute('type'),
    element.getAttribute('Type'),
    element.querySelector('SubtypeName')?.textContent,
    element.tagName,
  ].filter(Boolean).join(' ').toLowerCase()

  const blockTypes = blockElements.map(typeForBlock)
  const countMatching = (...patterns: string[]) => blockTypes.filter((type) => patterns.some((pattern) => type.includes(pattern))).length
  const allModelBlocks = blockElements.map((element, index) => {
    const position = elementPosition(element) ?? { x: 0, y: 0, z: 0 }
    const subtype = element.querySelector('SubtypeName')?.textContent?.trim() || typeForBlock(element) || `Block ${index + 1}`
    const blockType = `${typeForBlock(element)} ${subtype}`
    const orientation = orientationForBlock(element)
    const footprint = blueprintBlockFootprint(blockType)
    return {
      x: position.x,
      y: position.y,
      z: position.z,
      category: blueprintBlockCategory(blockType),
      shape: blueprintBlockShape(blockType),
      subtype,
      ...orientation,
      ...footprint,
    }
  })
  const stride = Math.max(1, Math.ceil(allModelBlocks.length / blueprintModelBlockLimit))
  const modelBlocks = allModelBlocks.filter((_, index) => index % stride === 0).slice(0, blueprintModelBlockLimit)
  const bounds = normalizeBounds(boundsForBlocks(allModelBlocks))
  const gridNames = gridElements
    .map((grid) => grid.querySelector('DisplayName')?.textContent?.trim() || '')
    .filter(Boolean)
  const displayNames = Array.from(document.querySelectorAll('DisplayName'))
    .map((element) => element.textContent?.trim() || '')
    .filter(Boolean)
  const cleanName = [...gridNames, ...displayNames].find((name) => !/[\uE000-\uF8FF]/u.test(name))
  const displayName = cleanName || readText('EntityId') || fileName.replace(/\.(sbc|xml)$/i, '')
  const largestGrid = gridNames.find((name) => !/[\uE000-\uF8FF]/u.test(name))
    || gridElements.map((grid) => grid.querySelector('EntityId')?.textContent?.trim()).find(Boolean)
    || displayName

  return {
    id: `blueprint-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    fileName,
    name: displayName,
    importedAt: Date.now(),
    rawSize: text.length,
    gridCount: Math.max(1, gridElements.length),
    blockCount: blockElements.length,
    largestGrid,
    cockpitCount: countMatching('cockpit', 'flightseat', 'remotecontrol'),
    thrusterCount: countMatching('thrust'),
    gyroCount: countMatching('gyro'),
    cargoCount: countMatching('cargo', 'container'),
    batteryCount: countMatching('battery'),
    reactorCount: countMatching('reactor'),
    jumpDriveCount: countMatching('jumpdrive'),
    connectorCount: countMatching('connector'),
    renderedBlockCount: modelBlocks.length,
    bounds,
    modelBlocks,
    notes: blockElements.length ? 'Parsed from Space Engineers blueprint XML.' : 'Parsed XML but no CubeBlocks section was detected.',
  }
}

function portraitOptionForId(id?: string) {
  return portraitOptions.find((option) => option.id === id) ?? portraitOptions[0]
}

function portraitBackgroundStyle(id?: string): CSSProperties {
  const portrait = portraitOptionForId(id)
  const x = portrait.column === 0 ? 0 : (portrait.column / 3) * 100
  const y = portrait.row === 0 ? 0 : (portrait.row / 2) * 100
  return {
    backgroundImage: `url("${portrait.sheetUrl}")`,
    backgroundPosition: `${x}% ${y}%`,
  }
}

function generatedPortraitStyle(portrait: GeneratedPortrait): CSSProperties {
  return {
    '--portrait-skin': portrait.skinTone,
    '--portrait-hair': portrait.hairColor,
    '--portrait-eye': portrait.eyeColor,
    '--portrait-uniform': portrait.uniformColor,
    '--portrait-accent': portrait.accentColor,
  } as CSSProperties
}

function portraitFromDraft(draft: PortraitMakerDraft, existing?: GeneratedPortrait): GeneratedPortrait {
  return {
    id: existing?.id ?? `portrait-maker-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    name: draft.name.trim() || 'Unnamed Portrait',
    skinTone: draft.skinTone,
    hairColor: draft.hairColor,
    eyeColor: draft.eyeColor,
    uniformColor: draft.uniformColor,
    accentColor: draft.accentColor,
    hairStyle: draft.hairStyle,
    notes: draft.notes.trim(),
    createdAt: existing?.createdAt ?? Date.now(),
  }
}

function createDefaultPortraitDraft(): PortraitMakerDraft {
  return {
    name: '',
    skinTone: '#d7a379',
    hairColor: '#1e1511',
    eyeColor: '#2f6f8f',
    uniformColor: '#243f66',
    accentColor: '#7de8d2',
    hairStyle: 'swept',
    notes: '',
  }
}

function portraitDraftFromGenerated(portrait: GeneratedPortrait): PortraitMakerDraft {
  return {
    name: portrait.name,
    skinTone: portrait.skinTone,
    hairColor: portrait.hairColor,
    eyeColor: portrait.eyeColor,
    uniformColor: portrait.uniformColor,
    accentColor: portrait.accentColor,
    hairStyle: portrait.hairStyle,
    notes: portrait.notes,
  }
}

function createDefaultMetagameDraft(): MetagameDraft {
  return {
    kind: 'System Note',
    name: '',
    visibility: 'GM-only',
    status: 'Draft',
    tags: '',
    notes: '',
  }
}

function metagameDraftFromRecord(record: MetagameRecord): MetagameDraft {
  return {
    kind: record.kind,
    name: record.name,
    visibility: record.visibility,
    status: record.status,
    tags: record.tags.join(', '),
    notes: record.notes,
  }
}

function metagameRecordFromDraft(draft: MetagameDraft, existing?: MetagameRecord): MetagameRecord {
  return {
    id: existing?.id ?? `meta-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    kind: draft.kind,
    name: draft.name.trim(),
    visibility: draft.visibility,
    status: draft.status.trim() || 'Draft',
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    notes: draft.notes.trim(),
    createdAt: existing?.createdAt ?? Date.now(),
  }
}

function defaultPortraitIdForRecord(name: string, role = '') {
  const key = `${name} ${role}`.toLowerCase()
  if (key.includes('captain') || key.includes('hales') || key.includes('owner')) return 'portrait-owner-grey'
  if (key.includes('first officer') || key.includes('executive') || key.includes('mara')) return 'portrait-command-red'
  if (key.includes('pilot') || key.includes('flight') || key.includes('kessa')) return 'portrait-flight-white'
  if (key.includes('engineer') || key.includes('cheng') || key.includes('toren')) return 'portrait-engineer-veteran'
  if (key.includes('doctor') || key.includes('medical') || key.includes('selene')) return 'portrait-medical-white'
  if (key.includes('security') || key.includes('tactical') || key.includes('garran')) return 'portrait-security-blue'
  if (key.includes('steward') || key.includes('cook') || key.includes('broker') || key.includes('luca')) return 'portrait-dock-amber'
  if (key.includes('passenger') || key.includes('civilian')) return 'portrait-crew-olive'
  return portraitOptions[hashString(key) % portraitOptions.length].id
}

function passengerPortraitId(file: PassengerFile) {
  return file.portraitId || defaultPortraitIdForRecord(file.name, `Passenger ${file.status} ${file.risk}`)
}

function GeneratedPortraitPreview({ portrait, className = 'shipOsRecordPortrait' }: { portrait: GeneratedPortrait; className?: string }) {
  return (
    <i className={`${className} shipOsGeneratedPortrait hair-${portrait.hairStyle}`} style={generatedPortraitStyle(portrait)} title={portrait.name}>
      <span className="shipOsGeneratedNeck" />
      <span className="shipOsGeneratedUniform" />
      <span className="shipOsGeneratedHead">
        <span className="shipOsGeneratedHair" />
        <span className="shipOsGeneratedEyes"><b /><b /></span>
        <span className="shipOsGeneratedNose" />
        <span className="shipOsGeneratedMouth" />
      </span>
      <span className="shipOsGeneratedCollar" />
    </i>
  )
}

function PortraitTile({ portraitId, customPortraits, className = 'shipOsRecordPortrait' }: { portraitId?: string; customPortraits: GeneratedPortrait[]; className?: string }) {
  const customPortrait = customPortraits.find((portrait) => portrait.id === portraitId)
  if (customPortrait) return <GeneratedPortraitPreview portrait={customPortrait} className={className} />
  return <i className={className} style={portraitBackgroundStyle(portraitId)} />
}

function ColorSwatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div className="shipOsColorSwatches" aria-label={label}>
      {colors.map((color) => (
        <button
          type="button"
          key={color}
          className={color.toLowerCase() === value.toLowerCase() ? 'active' : ''}
          aria-label={`Use ${color} for ${label}`}
          aria-pressed={color.toLowerCase() === value.toLowerCase()}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          title={color}
        />
      ))}
    </div>
  )
}

function ContactFilterChecklist({
  contacts,
  filters,
  factionOptions,
  visibleCount,
  memoryCount,
  memoryVisible,
  onToggleClass,
  onToggleIff,
  onToggleFaction,
  onSetAll,
  onToggleMemory,
}: {
  contacts: ShipContact[]
  filters: ContactFilterState
  factionOptions: ContactFactionOption[]
  visibleCount: number
  memoryCount: number
  memoryVisible: boolean
  onToggleClass: (id: ContactClassFilterId, enabled: boolean) => void
  onToggleIff: (id: ContactIffFilterId, enabled: boolean) => void
  onToggleFaction: (id: string, enabled: boolean) => void
  onSetAll: (enabled: boolean) => void
  onToggleMemory: (enabled: boolean) => void
}) {
  const hiddenCount = Math.max(0, contacts.length - visibleCount)
  const classCounts = contactClassFilterOptions.reduce((counts, option) => {
    counts[option.id] = contacts.filter((contact) => contactClassFilterId(contact) === option.id).length
    return counts
  }, {} as Record<ContactClassFilterId, number>)
  const iffCounts = contactIffFilterOptions.reduce((counts, option) => {
    counts[option.id] = contacts.filter((contact) => contactIffFilterId(contact) === option.id).length
    return counts
  }, {} as Record<ContactIffFilterId, number>)
  const factionCounts = factionOptions.reduce((counts, option) => {
    counts[option.id] = contacts.filter((contact) => contactFactionFilterId(contact) === option.id).length
    return counts
  }, {} as Record<string, number>)

  return (
    <details className="shipOsContactFilters">
      <summary aria-label="Sensor contact visibility filters">
        <div>
          <span>Sensor Layer Filters</span>
          <strong>{visibleCount.toLocaleString()} live / {memoryCount.toLocaleString()} memory</strong>
        </div>
        <small>{hiddenCount ? `${hiddenCount.toLocaleString()} current contacts hidden by filters/search` : `${contacts.length.toLocaleString()} current contacts`}</small>
        <span className="shipOsFilterDrawerCue" aria-hidden="true">
          <span className="shipOsFilterDrawerClosed">Open filters</span>
          <span className="shipOsFilterDrawerOpen">Close filters</span>
        </span>
      </summary>
      <div className="shipOsFilterDrawerPanel">
        <div className="shipOsFilterQuickActions">
          <button type="button" onClick={() => onSetAll(true)}>Show all</button>
          <button type="button" onClick={() => onSetAll(false)}>Hide all</button>
          <small>GPS fixes and friendly or owned contacts are pinned to the chart.</small>
        </div>
        <div className="shipOsFilterGroups">
          <fieldset>
            <legend>Object Class</legend>
            <div className="shipOsCheckGrid">
              {contactClassFilterOptions.map((option) => (
                <label key={option.id}>
                  <input
                    type="checkbox"
                    checked={filters.classes[option.id]}
                    onChange={(event) => onToggleClass(option.id, event.target.checked)}
                  />
                  <span>{option.label}</span>
                  <small>{contactFilterCountLabel(classCounts[option.id])}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>IFF / Disposition</legend>
            <div className="shipOsCheckGrid shipOsIffCheckGrid">
              {contactIffFilterOptions.map((option) => (
                <label key={option.id}>
                  <input
                    type="checkbox"
                    checked={option.id === 'owned' || option.id === 'friendly' || filters.iff[option.id]}
                    disabled={option.id === 'owned' || option.id === 'friendly'}
                    onChange={(event) => onToggleIff(option.id, event.target.checked)}
                  />
                  <span>{option.label}</span>
                  <small>{contactFilterCountLabel(iffCounts[option.id])}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Faction</legend>
            <div className="shipOsCheckGrid shipOsFactionCheckGrid">
              {factionOptions.map((option) => (
                <label key={option.id} title={option.source}>
                  <input
                    type="checkbox"
                    checked={filters.factions[option.id] ?? true}
                    onChange={(event) => onToggleFaction(option.id, event.target.checked)}
                  />
                  <span>{option.label}</span>
                  <small>{contactFilterCountLabel(factionCounts[option.id] ?? 0)}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>History</legend>
            <div className="shipOsCheckGrid">
              <label>
                <input type="checkbox" checked={memoryVisible} onChange={(event) => onToggleMemory(event.target.checked)} />
                <span>Encounter Memory</span>
                <small>{memoryCount.toLocaleString()} batched traces</small>
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </details>
  )
}

function PortraitSelector({ value, onChange, customPortraits }: { value: string; onChange: (id: string) => void; customPortraits: GeneratedPortrait[] }) {
  const selectedCustomPortrait = customPortraits.find((portrait) => portrait.id === value)
  const selectedPresetPortrait = portraitOptions.find((portrait) => portrait.id === value)
  const selectedPortraitLabel = selectedCustomPortrait?.name ?? selectedPresetPortrait?.label ?? 'Not selected'

  return (
    <div className="shipOsPortraitSelector">
      <header>
        <span>Portrait</span>
        <strong>{selectedPortraitLabel}</strong>
      </header>
      <div className="shipOsPortraitCollections">
        {customPortraits.length > 0 && (
          <section className="shipOsPortraitCollection">
            <header><span>Metagame Portraits</span><small>{customPortraits.length}</small></header>
            <div className="shipOsPortraitGrid">
              {customPortraits.map((portrait) => (
                <button
                  type="button"
                  key={portrait.id}
                  className={portrait.id === value ? 'active' : ''}
                  aria-pressed={portrait.id === value}
                  onClick={() => onChange(portrait.id)}
                  title={`${portrait.name}: Metagame portrait`}
                >
                  <PortraitTile portraitId={portrait.id} customPortraits={customPortraits} className="shipOsPortraitThumb" />
                  <strong>{portrait.name}</strong>
                  <small>Metagame portrait</small>
                </button>
              ))}
            </div>
          </section>
        )}
        {portraitSheetConfigs.map((sheet) => (
          <section className="shipOsPortraitCollection" key={sheet.url}>
            <header><span>{sheet.label}</span><small>{sheet.entries.length}</small></header>
            <div className="shipOsPortraitGrid">
              {portraitOptions.filter((option) => option.sheetUrl === sheet.url).map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={option.id === value ? 'active' : ''}
                  aria-pressed={option.id === value}
                  onClick={() => onChange(option.id)}
                  title={`${option.label}: ${option.specialty}`}
                >
                  <PortraitTile portraitId={option.id} customPortraits={customPortraits} className="shipOsPortraitThumb" />
                  <strong>{option.label}</strong>
                  <small>{option.specialty}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonthKey() {
  return currentIsoDate().slice(0, 7)
}

function departmentFromRole(role: string) {
  const normalized = role.toLowerCase()
  if (normalized.includes('captain') || normalized.includes('first officer') || normalized.includes('executive')) return 'Command'
  if (normalized.includes('pilot') || normalized.includes('flight')) return 'Flight'
  if (normalized.includes('engineer') || normalized.includes('cheng')) return 'Engineering'
  if (normalized.includes('doctor') || normalized.includes('medical')) return 'Medical'
  if (normalized.includes('security') || normalized.includes('tactical')) return 'Security'
  if (normalized.includes('steward') || normalized.includes('cook') || normalized.includes('galley')) return 'Hospitality'
  if (normalized.includes('comms') || normalized.includes('signals')) return 'Signals'
  return 'Operations'
}

function normalizeCrewMember(member: CrewMember): CrewMember {
  const department = member.department || departmentFromRole(member.role)
  return {
    ...member,
    serviceNumber: member.serviceNumber || `INT-${department.slice(0, 3).toUpperCase()}-${member.id.slice(-4).toUpperCase()}`,
    department,
    billet: member.billet || member.role,
    rateMonthly: Number.isFinite(member.rateMonthly) ? member.rateMonthly : 0,
    contractStatus: member.contractStatus || (member.clearance === 'Applicant' || member.clearance === 'Candidate' ? 'Pending hire' : 'Active'),
    registryStanding: member.registryStanding || 'Unverified',
    quarters: member.quarters || 'Unassigned berth',
    medicalStatus: member.medicalStatus || 'Intake needed',
    credentials: member.credentials?.length ? member.credentials : [member.clearance],
    notes: member.notes || member.status,
    hiredAt: member.hiredAt || Date.now(),
    portraitId: member.portraitId || defaultPortraitIdForRecord(member.name, member.role),
  }
}

function createDefaultCrewDraft(): CrewFormDraft {
  return {
    portraitId: 'portrait-flight-white',
    name: '',
    role: 'Pilot / Flight Officer',
    department: 'Flight',
    serviceNumber: '',
    billet: 'Flight Officer',
    rateMonthly: '2500',
    contractStatus: 'Active - two months paid upfront',
    registryStanding: 'Good',
    quarters: 'Private crew cabin',
    shift: 'Alpha',
    status: 'Ready for shipboard intake',
    clearance: 'Flight',
    medicalStatus: 'Intake needed',
    credentials: 'Local flight accreditation, Long-haul transit clearance',
    notes: '',
  }
}

function crewDraftFromMember(member: CrewMember): CrewFormDraft {
  const normalized = normalizeCrewMember(member)
  return {
    portraitId: normalized.portraitId || defaultPortraitIdForRecord(normalized.name, normalized.role),
    name: normalized.name,
    role: normalized.role,
    department: normalized.department || departmentFromRole(normalized.role),
    serviceNumber: normalized.serviceNumber || '',
    billet: normalized.billet || normalized.role,
    rateMonthly: String(normalized.rateMonthly || 0),
    contractStatus: normalized.contractStatus || '',
    registryStanding: normalized.registryStanding || '',
    quarters: normalized.quarters || '',
    shift: normalized.shift,
    status: normalized.status,
    clearance: normalized.clearance,
    medicalStatus: normalized.medicalStatus || '',
    credentials: normalized.credentials?.join(', ') || '',
    notes: normalized.notes || '',
  }
}

function crewMemberFromDraft(draft: CrewFormDraft, existing?: CrewMember): CrewMember {
  const rateMonthly = Number(draft.rateMonthly)
  const role = draft.role.trim()
  const department = draft.department.trim() || departmentFromRole(role)
  return {
    id: existing?.id ?? `crew-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    name: draft.name.trim(),
    role,
    serviceNumber: draft.serviceNumber.trim() || existing?.serviceNumber || `INT-${department.slice(0, 3).toUpperCase()}-${Math.round(Math.random() * 9000 + 1000)}`,
    department,
    billet: draft.billet.trim() || role,
    rateMonthly: Number.isFinite(rateMonthly) ? Math.max(0, rateMonthly) : 0,
    contractStatus: draft.contractStatus.trim() || 'Active',
    registryStanding: draft.registryStanding.trim() || 'Unverified',
    quarters: draft.quarters.trim() || 'Unassigned berth',
    shift: draft.shift.trim() || 'Reserve',
    status: draft.status.trim() || 'Ready',
    clearance: draft.clearance.trim() || 'Crew',
    medicalStatus: draft.medicalStatus.trim() || 'Intake needed',
    credentials: draft.credentials.split(',').map((credential) => credential.trim()).filter(Boolean),
    notes: draft.notes.trim(),
    hiredAt: existing?.hiredAt ?? Date.now(),
    portraitId: draft.portraitId || existing?.portraitId || defaultPortraitIdForRecord(draft.name, draft.role),
  }
}

function createDefaultJobDraft(): JobDraft {
  return {
    title: '',
    client: 'Passenger Exchange',
    route: 'Asterion Orbital ->',
    destination: '',
    status: 'Prospect',
    payout: '',
    departure: currentIsoDate(),
    due: currentIsoDate(),
    notes: '',
  }
}

function jobDraftFromRecord(job: JobRecord): JobDraft {
  return {
    title: job.title,
    client: job.client,
    route: job.route,
    destination: job.destination,
    status: job.status,
    payout: String(job.payout || 0),
    departure: job.departure,
    due: job.due,
    notes: job.notes,
  }
}

function jobRecordFromDraft(draft: JobDraft, existing?: JobRecord): JobRecord {
  const payout = Math.abs(Number(draft.payout))
  return {
    id: existing?.id ?? `job-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    title: draft.title.trim(),
    client: draft.client.trim() || 'Unlisted client',
    route: draft.route.trim() || 'Route pending',
    destination: draft.destination.trim() || 'TBD',
    status: draft.status,
    payout: Number.isFinite(payout) ? payout : 0,
    departure: draft.departure || currentIsoDate(),
    due: draft.due || draft.departure || currentIsoDate(),
    notes: draft.notes.trim(),
    createdAt: existing?.createdAt ?? Date.now(),
  }
}

function createDefaultPassengerDraft(jobId = holdingJobId): PassengerDraft {
  return {
    portraitId: 'portrait-crew-olive',
    jobId,
    name: '',
    manifestId: '',
    origin: 'Asterion Orbital',
    destination: '',
    cabin: 'Unassigned cabin',
    fare: '',
    status: 'Prospect',
    clearance: 'Pending verification',
    risk: 'Low',
    baggageKg: '0',
    contact: 'Passenger Exchange',
    medical: 'No flag',
    notes: '',
  }
}

function passengerDraftFromFile(file: PassengerFile): PassengerDraft {
  return {
    portraitId: passengerPortraitId(file),
    jobId: file.jobId,
    name: file.name,
    manifestId: file.manifestId,
    origin: file.origin,
    destination: file.destination,
    cabin: file.cabin,
    fare: String(file.fare || 0),
    status: file.status,
    clearance: file.clearance,
    risk: file.risk,
    baggageKg: String(file.baggageKg || 0),
    contact: file.contact,
    medical: file.medical,
    notes: file.notes,
  }
}

function passengerFileFromDraft(draft: PassengerDraft, existing?: PassengerFile): PassengerFile {
  const fare = Math.abs(Number(draft.fare))
  const baggageKg = Math.abs(Number(draft.baggageKg))
  const destination = draft.destination.trim() || 'TBD'
  return {
    id: existing?.id ?? `pax-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    jobId: draft.jobId || holdingJobId,
    name: draft.name.trim(),
    manifestId: draft.manifestId.trim() || `PAX-${Math.round(Math.random() * 900000 + 100000)}`,
    origin: draft.origin.trim() || 'Asterion Orbital',
    destination,
    cabin: draft.cabin.trim() || 'Unassigned cabin',
    fare: Number.isFinite(fare) ? fare : 0,
    status: draft.status,
    clearance: draft.clearance.trim() || 'Pending verification',
    risk: draft.risk.trim() || 'Low',
    baggageKg: Number.isFinite(baggageKg) ? baggageKg : 0,
    contact: draft.contact.trim() || 'Passenger Exchange',
    medical: draft.medical.trim() || 'No flag',
    notes: draft.notes.trim(),
    createdAt: existing?.createdAt ?? Date.now(),
    portraitId: draft.portraitId || existing?.portraitId || defaultPortraitIdForRecord(draft.name, `Passenger ${draft.status}`),
  }
}

function jobStatusRank(status: JobRecord['status']) {
  const ranks: Record<JobRecord['status'], number> = {
    Boarding: 0,
    Booked: 1,
    Prospect: 2,
    'In Transit': 3,
    'On Hold': 4,
    Complete: 5,
  }
  return ranks[status]
}

function minutesUntil(timestamp?: number) {
  if (!timestamp) return ''
  return `${Math.max(0, Math.ceil((timestamp - Date.now()) / 60000))} min`
}

function contactKindLabel(kind: ShipContactKind) {
  return plottedContactKinds.find((item) => item.id === kind)?.label
    ?? (kind === 'body' ? 'Planetary Body' : kind === 'custom' ? 'Custom Plot' : kind)
}

function defaultClassForContactKind(kind: ShipContactKind) {
  return plottedContactKinds.find((item) => item.id === kind)?.className ?? 'Waypoint'
}

function colorForContactKind(kind: ShipContactKind) {
  if (kind === 'gps') return '#3dff93'
  if (kind === 'waypoint' || kind === 'custom') return '#f1e2c6'
  if (kind === 'asteroid') return '#8d9498'
  if (kind === 'radar') return '#8fb4ff'
  if (kind === 'signal') return '#ff6b61'
  if (kind === 'ship') return '#d68ebd'
  if (kind === 'station') return '#f6b94d'
  if (kind === 'relay') return '#63d7ff'
  return '#7de8d2'
}

function statusForContactKind(kind: ShipContactKind) {
  if (kind === 'gps') return 'GPS imported'
  if (kind === 'asteroid') return 'Asteroid contact'
  if (kind === 'radar') return 'Radar contact'
  if (kind === 'signal') return 'Unidentified signal'
  if (kind === 'ship') return 'Vessel contact'
  if (kind === 'station') return 'Station contact'
  if (kind === 'relay') return 'Relay contact'
  return 'User plotted'
}

function createDefaultWaypointDraft(kind: ShipContactKind = 'gps'): DraftWaypoint {
  return {
    name: '',
    className: defaultClassForContactKind(kind),
    kind,
    x: '',
    y: '',
    z: '',
    notes: '',
  }
}

function parseGpsColor(value?: string) {
  if (!value) return colorForContactKind('gps')
  const clean = value.trim().replace('#', '')
  if (clean.length === 8) return `#${clean.slice(2)}`
  if (clean.length === 6) return `#${clean}`
  return colorForContactKind('gps')
}

function parseSpaceEngineersGpsLines(raw: string): ShipContact[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index): ShipContact | null => {
      const match = line.match(/^GPS:([^:]*):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):?([^:]*)?:?/i)
      if (!match) return null
      const x = Number(match[2])
      const y = Number(match[3])
      const z = Number(match[4])
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
      const name = match[1]?.trim() || `GPS ${index + 1}`
      return {
        id: `gps-${Date.now()}-${index}-${Math.round(Math.random() * 10000)}`,
        name,
        className: 'GPS fix',
        kind: 'gps' as const,
        x,
        y,
        z,
        status: 'GPS imported',
        color: parseGpsColor(match[5]),
        notes: line,
      }
    })
    .filter((contact): contact is ShipContact => Boolean(contact))
}

function normalizeTelemetryContactKind(value: unknown): ShipContactKind {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'body' || normalized === 'planet' || normalized === 'moon') return 'body'
  if (normalized === 'gps') return 'gps'
  if (normalized === 'asteroid' || normalized === 'ore' || normalized === 'resource') return 'asteroid'
  if (normalized === 'radar' || normalized === 'contact') return 'radar'
  if (normalized === 'signal' || normalized === 'unknown' || normalized === 'unidentified') return 'signal'
  if (normalized === 'ship' || normalized === 'vessel') return 'ship'
  if (normalized === 'station' || normalized === 'base') return 'station'
  if (normalized === 'relay' || normalized === 'beacon' || normalized === 'antenna' || normalized === 'radio' || normalized === 'broadcast') return 'relay'
  if (normalized === 'waypoint') return 'waypoint'
  return 'signal'
}

function cleanTelemetryContactName(value: string) {
  const original = value.trim()
  if (!original) return ''
  const withoutPrefix = original
    .replace(/^SB[_\s-]*\d+[\s,;:/|_-]*/i, '')
    .replace(/^SE[_\s-]*\d+[\s,;:/|_-]*/i, '')
    .replace(/^Entity[_\s-]*\d+[\s,;:/|_-]*/i, '')
    .replace(/^Grid[_\s-]*\d+[\s,;:/|_-]*/i, '')
    .replace(/^[\s,;:/|_-]+/, '')
    .trim()
  return withoutPrefix || original
}

function isInternalTelemetryContactName(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return normalized.includes('dshield')
    || normalized.includes('defensiveshield')
    || normalized.includes('defense shield')
    || normalized.includes('defensive shield')
    || normalized.includes('shieldentity')
    || normalized.includes('shield field')
    || normalized.includes('shield hit')
}

function isHiddenTelemetryContact(contact: {
  id?: unknown
  name?: unknown
  className?: unknown
  status?: unknown
  notes?: unknown
  sourceName?: unknown
  antennaName?: unknown
}) {
  const haystack = [
    contact.id,
    contact.name,
    contact.className,
    contact.status,
    contact.notes,
    contact.sourceName,
    contact.antennaName,
  ].map((value) => String(value || '')).join(' ')
  return isInternalTelemetryContactName(haystack)
}

function asteroidShortLabelFromSeed(seed: string, fallbackIndex = 0) {
  const normalized = seed.trim()
  const numeric = normalized.match(/(?:^|[^\d])(\d{1,4})(?:[^\d]|$)/)
  if (numeric) return `A-${numeric[1].padStart(3, '0')}`
  return `A-${String((hashString(`${normalized || 'asteroid'}-${fallbackIndex}`) % 900) + 100)}`
}

function asteroidShortLabel(contact: Pick<ShipContact, 'id' | 'name' | 'kind' | 'shortLabel'>, fallbackIndex = 0) {
  if (contact.kind !== 'asteroid') return contact.name
  if (contact.shortLabel?.trim()) return contact.shortLabel.trim()
  return asteroidShortLabelFromSeed(`${contact.name} ${contact.id}`, fallbackIndex)
}

function isGenericAsteroidName(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return true
  if (/^contact\s+\d+$/i.test(value)) return true
  if (/^asteroid(?:\s+return)?(?:\s+\d+)?$/i.test(value)) return true
  if (/^\d{8,}$/.test(normalized)) return true
  return false
}

function generatedAsteroidName(seed: string, shortLabel: string) {
  const hash = hashString(seed || shortLabel)
  const adjective = asteroidNameAdjectives[hash % asteroidNameAdjectives.length]
  const noun = asteroidNameNouns[Math.floor(hash / asteroidNameAdjectives.length) % asteroidNameNouns.length]
  return `${adjective} ${noun} ${shortLabel}`
}

function mapLabelForContact(contact: ShipContact, fallbackIndex = 0) {
  if (contact.manualName && contact.name.trim()) return contact.name.trim()
  return contact.kind === 'asteroid' ? asteroidShortLabel(contact, fallbackIndex) : cleanTelemetryContactName(contact.name)
}

function contactFileTitle(contact: ShipContact) {
  if (contact.manualName && contact.name.trim()) return contact.name.trim()
  if (contact.kind === 'asteroid') return contact.name
  return cleanTelemetryContactName(contact.name) || contact.name
}

function originalNameForContact(contact: ShipContact) {
  const cleanName = cleanTelemetryContactName(contact.name)
  if (contact.sourceName && contact.sourceName !== contact.name) return contact.sourceName
  if (cleanName && cleanName !== contact.name) return contact.name
  return ''
}

function shouldShowContactLabel(contact: ShipContact, selected: boolean) {
  if (selected) return true
  if (isFriendlyContact(contact)) return true
  if (contact.kind === 'asteroid') return true
  return ['gps', 'waypoint', 'signal', 'station', 'relay', 'custom'].includes(contact.kind)
}

function contactManualDisposition(contact: ShipContact): ContactDispositionOverride | null {
  return contact.manualDisposition ?? null
}

function applyContactDispositionOverride(contact: ShipContact, disposition?: ContactDispositionOverride): ShipContact {
  if (!disposition) return contact
  return { ...contact, relationship: disposition, manualDisposition: disposition }
}

function contactDispositionLabel(disposition: ContactDispositionId) {
  return contactDispositionOptions.find((option) => option.id === disposition)?.label ?? disposition
}

function isHostileContact(contact: ShipContact) {
  if (contact.kind === 'body' || contact.id === currentShipContactId) return false
  const manualDisposition = contactManualDisposition(contact)
  if (manualDisposition) return manualDisposition === 'hostile'
  const relationship = contact.relationship?.trim().toLowerCase()
  if (relationship && /\b(hostile|enemy|pirate|raider|marauder|bandit|threat|red)\b/.test(relationship)) return true
  const searchText = [
    contact.name,
    contact.className,
    contact.status,
    contact.notes,
    contact.sourceName ?? '',
  ].join(' ').toLowerCase()
  return /\b(hostile|enemy|pirate|raider|marauder|bandit|attack|attacking|weapon lock|red contact|threat)\b/.test(searchText)
}

function displayColorForContact(contact: ShipContact) {
  if (isHostileContact(contact)) return '#ff0000'
  const relationship = contact.relationship?.toLowerCase()
  if (relationship === 'friendly' || relationship === 'ally' || relationship === 'owned') return '#75d69d'
  if (relationship === 'neutral') return '#c9cdd2'
  if (relationship === 'unknown') return contact.kind === 'asteroid' ? '#8d9498' : '#d68ebd'
  if (contact.kind === 'asteroid') return '#8d9498'
  return contact.color
}

function contactClassFilterId(contact: ShipContact): ContactClassFilterId {
  if (contact.kind === 'body') return 'bodies'
  if (contact.kind === 'station') return 'stations'
  if (contact.kind === 'ship') return 'ships'
  if (contact.kind === 'asteroid') return 'asteroids'
  if (contact.kind === 'radar') return 'radar'
  if (contact.kind === 'signal') return 'signals'
  if (contact.kind === 'relay') return 'relays'
  return 'gpsWaypoints'
}

function isFriendlyContact(contact: ShipContact) {
  if (isHostileContact(contact)) return false
  const manualDisposition = contactManualDisposition(contact)
  if (manualDisposition) return manualDisposition === 'owned' || manualDisposition === 'friendly'
  const relationship = contact.relationship?.trim().toLowerCase() ?? ''
  const searchText = [
    relationship,
    contact.className,
    contact.status,
    contact.notes,
  ].join(' ').toLowerCase()
  return /\b(friendly|ally|allied|owned|green|trusted|fleet|crew|shipboard)\b/.test(searchText)
}

function isDefenseGridContact(contact: ShipContact) {
  if (contact.id === currentShipContactId || contact.kind === 'body' || isHostileContact(contact)) return false
  const manualDisposition = contactManualDisposition(contact)
  if (manualDisposition === 'owned') return true
  if (manualDisposition) return false
  const relationship = contact.relationship?.trim().toLowerCase() ?? ''
  const source = contact.contactSource?.trim().toLowerCase() ?? ''
  const classStatusText = [contact.className, contact.status].join(' ').toLowerCase()
  const gridLike = contact.kind === 'ship'
    || contact.kind === 'station'
    || ['grid', 'antenna', 'beacon'].includes(source)
    || /\b(grid|antenna contact|beacon contact|static grid|mobile grid)\b/.test(classStatusText)
  const ownedByPlayer = relationship === 'owned' || /\bowned\b/.test(classStatusText)
  return gridLike && ownedByPlayer
}

function isNeutralContact(contact: ShipContact) {
  if (isHostileContact(contact) || isFriendlyContact(contact)) return false
  const manualDisposition = contactManualDisposition(contact)
  if (manualDisposition) return manualDisposition === 'neutral'
  const relationship = contact.relationship?.trim().toLowerCase() ?? ''
  const searchText = [
    relationship,
    contact.className,
    contact.status,
    contact.notes,
  ].join(' ').toLowerCase()
  return /\b(neutral|civilian|unclassified|white|local traffic|commercial)\b/.test(searchText)
}

function contactDefenseEnvelope(contact: ShipContact) {
  if (contact.id === currentShipContactId || isDefenseGridContact(contact)) {
    return {
      color: '#3dff93',
      label: '4 km point defense / 8 km extended defense',
      ranges: defenseEnvelopeRingsMeters,
    }
  }
  if (['body', 'gps', 'waypoint', 'relay'].includes(contact.kind)) return null
  if (isHostileContact(contact) || contact.kind === 'asteroid') return null
  if (isNeutralContact(contact)) {
    return {
      color: '#f4f7f8',
      label: '4 km neutral traffic envelope',
      ranges: contactEnvelopeRingsMeters,
    }
  }
  return null
}

function contactIffFilterId(contact: ShipContact): ContactIffFilterId {
  if (isHostileContact(contact)) return 'hostile'
  if (isDefenseGridContact(contact)) return 'owned'
  if (isFriendlyContact(contact)) return 'friendly'
  if (isNeutralContact(contact)) return 'neutral'
  return 'unknown'
}

function contactAlwaysVisible(contact: ShipContact) {
  return contact.kind === 'gps' || isFriendlyContact(contact)
}

function contactVisibleByFilters(contact: ShipContact, filters: ContactFilterState) {
  if (contactAlwaysVisible(contact)) return true
  const factionId = contactFactionFilterId(contact)
  return filters.classes[contactClassFilterId(contact)]
    && filters.iff[contactIffFilterId(contact)]
    && (filters.factions[factionId] ?? true)
}

function contactMemoryKey(contact: ShipContact) {
  if (contact.entityId) return `${contact.kind}:entity:${contact.entityId}`
  if (!contact.id.startsWith('uplink-contact-')) return `${contact.kind}:id:${contact.id}`
  const sourceName = normalizeContactSearchText(contact.sourceName || contact.name) || 'unnamed'
  const x = Math.round(contact.x / 250)
  const y = Math.round(contact.y / 250)
  const z = Math.round(contact.z / 250)
  return `${contact.kind}:fallback:${sourceName}:${x}:${y}:${z}`
}

function encounterMemoryRecord(contact: ShipContact, seenAt: number): EncounterMemoryContact {
  return {
    key: contactMemoryKey(contact),
    id: contact.id,
    name: contactFileTitle(contact),
    kind: contact.kind,
    color: displayColorForContact(contact),
    classFilter: contactClassFilterId(contact),
    iff: contactIffFilterId(contact),
    factionFilter: contactFactionFilterId(contact),
    x: Math.round(contact.x),
    y: Math.round(contact.y),
    z: Math.round(contact.z),
    firstSeen: seenAt,
    lastSeen: seenAt,
  }
}

function mergeEncounterMemory(current: EncounterMemoryContact[], contacts: ShipContact[], seenAt: number) {
  if (!contacts.length) return current
  const records = new Map(current.map((record) => [record.key, record] as const))
  let changed = false

  contacts.forEach((contact) => {
    if (contact.kind === 'body' || contact.id === currentShipContactId) return
    const incoming = encounterMemoryRecord(contact, seenAt)
    const existing = records.get(incoming.key)
    const next = existing ? { ...incoming, firstSeen: existing.firstSeen } : incoming
    if (!existing || JSON.stringify(existing) !== JSON.stringify(next)) {
      records.set(incoming.key, next)
      changed = true
    }
  })

  return changed ? Array.from(records.values()) : current
}

function memoryContactVisibleByFilters(contact: EncounterMemoryContact, filters: ContactFilterState) {
  return filters.classes[contact.classFilter]
    && filters.iff[contact.iff]
    && (filters.factions[contact.factionFilter] ?? true)
}

function memoryContactAlwaysVisible(contact: EncounterMemoryContact) {
  return contact.kind === 'gps' || contact.iff === 'friendly' || contact.iff === 'owned'
}

function contactFilterCountLabel(count: number) {
  return count.toLocaleString()
}

function normalizeContactSearchText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function contactSearchHaystack(contact: ShipContact) {
  const gpsLine = `GPS:${contact.name}:${contact.x}:${contact.y}:${contact.z}:`
  return [
    contact.name,
    mapLabelForContact(contact),
    contact.sourceName ?? '',
    contactKindLabel(contact.kind),
    contactDispositionLabel(contactIffFilterId(contact)),
    contactFactionName(contact),
    contact.relationship ?? '',
    contact.contactSource ?? '',
    contact.antennaName ?? '',
    contact.className,
    contact.status,
    contact.notes,
    gpsLine,
    formatCoord(contact.x),
    formatCoord(contact.y),
    formatCoord(contact.z),
  ].join(' ').toLowerCase()
}

function contactMatchesSearch(contact: ShipContact, searchText: string) {
  const terms = normalizeContactSearchText(searchText).split(' ').filter(Boolean)
  if (!terms.length) return true
  const haystack = contactSearchHaystack(contact)
  return terms.every((term) => haystack.includes(term))
}

function normalizeContactSortState(sort?: Partial<ContactSortState> | null): ContactSortState {
  const candidateKey = sort?.key
  const key = contactSortOptions.some((option) => option.id === candidateKey) ? candidateKey as ContactSortKey : defaultContactSortState.key
  const direction = sort?.direction === 'desc' ? 'desc' : 'asc'
  return { key, direction }
}

function nextContactSortState(current: ContactSortState, key: ContactSortKey): ContactSortState {
  const normalized = normalizeContactSortState(current)
  if (normalized.key !== key) return { key, direction: 'asc' }
  return { key, direction: normalized.direction === 'asc' ? 'desc' : 'asc' }
}

function contactSortArrow(sort: ContactSortState, key: ContactSortKey) {
  if (sort.key !== key) return '↕'
  return sort.direction === 'asc' ? '↑' : '↓'
}

function contactSortValue(contact: ShipContact, distance: number, key: ContactSortKey) {
  if (key === 'distance') return distance
  if (key === 'name') return mapLabelForContact(contact)
  if (key === 'kind') return contactKindLabel(contact.kind)
  if (key === 'iff') return contactDispositionLabel(contactIffFilterId(contact))
  if (key === 'faction') return contactFactionName(contact) || 'Unassigned / Unknown'
  if (key === 'source') return contact.contactSource || contact.antennaName || contact.sourceName || ''
  if (key === 'className') return contact.className
  return contact.status
}

function compareContactRows(
  left: { contact: ShipContact; distance: number },
  right: { contact: ShipContact; distance: number },
  sort: ContactSortState,
) {
  const normalized = normalizeContactSortState(sort)
  const leftValue = contactSortValue(left.contact, left.distance, normalized.key)
  const rightValue = contactSortValue(right.contact, right.distance, normalized.key)
  let result = 0
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    result = leftValue - rightValue
  } else {
    result = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' })
  }
  if (result === 0) {
    result = mapLabelForContact(left.contact).localeCompare(mapLabelForContact(right.contact), undefined, { numeric: true, sensitivity: 'base' })
  }
  if (result === 0) result = left.distance - right.distance
  return normalized.direction === 'asc' ? result : -result
}

function createVelocityTelemetryRows(
  contacts: ShipContact[],
  currentShipContact: ShipContact,
  currentPosition: ShipCoordinate,
  selectedContactId: string | null,
): VelocityTelemetryRow[] {
  const ownVector = velocityVectorFromFields(currentShipContact)
  const ownSpeed = speedForMotion(ownVector, currentShipContact.speed)
  const ownRow: VelocityTelemetryRow = {
    id: currentShipContact.id,
    label: currentShipContact.name,
    kind: 'Ownship',
    source: ownVector ? 'Live vector' : 'No motion packet',
    rangeMeters: 0,
    absoluteSpeed: ownSpeed,
    relativeSpeed: ownVector ? 0 : null,
    rangeRate: 0,
    bearingDegrees: null,
    elevationDegrees: null,
    vector: ownVector,
    selected: selectedContactId === currentShipContact.id,
    contactId: currentShipContact.id,
  }

  const contactRows = contacts.map((contact): VelocityTelemetryRow => {
    const motion = motionVectorForContact(contact)
    const contactSpeed = speedForMotion(motion.vector, contact.speed)
    const rangeMeters = distanceMeters(currentPosition, contact)
    const relativeVector = ownVector && motion.vector ? subtractVelocity(motion.vector, ownVector) : null
    const bearing = bearingFromRelativePosition(contact, currentPosition)
    const rangeRate = relativeVector && bearing.unit ? dotVelocity(relativeVector, bearing.unit) : null
    return {
      id: contact.id,
      label: mapLabelForContact(contact),
      kind: contactKindLabel(contact.kind),
      source: motion.source,
      rangeMeters,
      absoluteSpeed: contactSpeed,
      relativeSpeed: relativeVector ? velocityMagnitude(relativeVector) : null,
      rangeRate,
      bearingDegrees: bearing.bearingDegrees,
      elevationDegrees: bearing.elevationDegrees,
      vector: motion.vector,
      selected: selectedContactId === contact.id,
      contactId: contact.id,
    }
  })

  return [ownRow, ...contactRows].sort((left, right) => {
    if (left.id === currentShipContact.id) return -1
    if (right.id === currentShipContact.id) return 1
    if (left.selected) return -1
    if (right.selected) return 1
    return (left.rangeMeters ?? Number.MAX_SAFE_INTEGER) - (right.rangeMeters ?? Number.MAX_SAFE_INTEGER)
  })
}

function defaultTelemetryNote(sourceIdentity: string, rawName: string, shortLabel?: string) {
  const labelText = shortLabel ? ` Tactical label ${shortLabel}.` : ''
  const sourceText = rawName ? ` Original SE contact: ${rawName}.` : ''
  return `Imported from telemetry packet ${sourceIdentity}.${labelText}${sourceText}`
}

function isDefaultTelemetryNote(note: string) {
  const normalized = note.trim()
  return !normalized
    || normalized.startsWith('Imported from telemetry packet ')
    || normalized.startsWith('Space Engineers entity ')
    || normalized.startsWith('Client plugin ')
}

function isTelemetryManagedContact(contact: ShipContact) {
  if (contact.telemetryManaged) return true
  const id = contact.id.trim().toLowerCase()
  const notes = contact.notes.trim()
  return ['se-', 'grid-', 'voxel-', 'signal-', 'planet-', 'uplink-contact-'].some((prefix) => id.startsWith(prefix))
    || ['antenna', 'beacon', 'grid', 'planet-registry'].includes(contact.contactSource?.trim().toLowerCase() ?? '')
    || notes.startsWith('Imported from telemetry packet ')
    || notes.startsWith('Space Engineers entity ')
    || notes.startsWith('Client plugin ')
}

function contactsFromTelemetryPacket(packet: TelemetryPacket): ShipContact[] {
  const rawContacts = Array.isArray(packet.contacts) ? packet.contacts : []
  const sourceIdentity = telemetryPacketIdentity(packet) || String(Date.now())
  return rawContacts.map((rawContact, index) => {
    if (!rawContact || typeof rawContact !== 'object') return null
    if (isHiddenTelemetryContact(rawContact)) return null
    const x = coerceTelemetryNumber(rawContact.x)
    const y = coerceTelemetryNumber(rawContact.y)
    const z = coerceTelemetryNumber(rawContact.z)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
    const kind = normalizeTelemetryContactKind(rawContact.kind)
    const id = rawContact.id?.trim() || `uplink-contact-${sourceIdentity}-${index}`
    const rawName = rawContact.name?.trim() || ''
    const cleanName = cleanTelemetryContactName(rawName)
    const shortLabel = kind === 'asteroid' ? asteroidShortLabelFromSeed(`${rawName} ${id}`, index) : undefined
    const name = kind === 'asteroid'
      ? isGenericAsteroidName(rawName)
        ? generatedAsteroidName(`${id} ${rawName}`, shortLabel || `A-${String(index + 1).padStart(3, '0')}`)
        : cleanName || rawName
      : cleanName || `${contactKindLabel(kind)} ${index + 1}`
    const rangeMeters = coerceTelemetryNumber(rawContact.distanceMeters)
    const rawNotes = rawContact.notes?.trim()
    const relationship = rawContact.relationship?.trim()
    const contactSource = rawContact.contactSource?.trim().toLowerCase()
    const antennaName = rawContact.antennaName?.trim()
    const faction = normalizeFactionName(rawContact.factionName)
      || normalizeFactionName(rawContact.faction)
      || normalizeFactionName(rawContact.owner)
    const velocityVector = velocityVectorFromFields(rawContact)
    const speed = coerceTelemetryNumber(rawContact.speed)
    const radiusMeters = coerceTelemetryNumber(rawContact.radiusMeters)
    const entityId = String(rawContact.entityId ?? '').trim()
    const generatorName = rawContact.generatorName?.trim()
    const storageName = rawContact.storageName?.trim()
    const hasAtmosphere = coerceTelemetryBoolean(rawContact.hasAtmosphere)
    const surfaceGravity = coerceTelemetryNumber(rawContact.surfaceGravity)
    const notes = rawNotes && kind === 'asteroid' && shortLabel && !rawNotes.includes(shortLabel)
      ? `${rawNotes} Tactical label ${shortLabel}.`
      : rawNotes || defaultTelemetryNote(sourceIdentity, rawName, shortLabel)
    const contact: ShipContact = {
      id,
      name,
      className: rawContact.className?.trim()
        || (contactSource === 'antenna' || contactSource === 'beacon' ? `${relationship || 'Unclassified'} ${contactSource} contact` : defaultClassForContactKind(kind)),
      kind,
      x: Number(x),
      y: Number(y),
      z: Number(z),
      status: rawContact.status?.trim() || statusForContactKind(kind),
      color: rawContact.color?.trim() || colorForContactKind(kind),
      notes,
      telemetryManaged: true,
    }
    if (shortLabel) contact.shortLabel = shortLabel
    if (rangeMeters !== undefined) contact.rangeMeters = rangeMeters
    if (radiusMeters !== undefined && radiusMeters > 0) contact.radiusMeters = radiusMeters
    if (entityId) contact.entityId = entityId
    if (generatorName) contact.generatorName = generatorName
    if (storageName) contact.storageName = storageName
    if (hasAtmosphere !== undefined) contact.hasAtmosphere = hasAtmosphere
    if (surfaceGravity !== undefined) contact.surfaceGravity = surfaceGravity
    if (rawName) contact.sourceName = rawName
    if (relationship) contact.relationship = relationship
    if (contactSource) contact.contactSource = contactSource
    if (antennaName) contact.antennaName = antennaName
    if (faction) contact.faction = faction
    if (velocityVector) {
      contact.velocityX = velocityVector.x
      contact.velocityY = velocityVector.y
      contact.velocityZ = velocityVector.z
    }
    if (speed !== undefined) contact.speed = speed
    else if (velocityVector) contact.speed = velocityMagnitude(velocityVector)
    return contact
  }).filter((contact): contact is ShipContact => Boolean(contact))
}

function applySavedTelemetryContactOverride(contact: ShipContact, saved?: ShipContact) {
  if (!saved || !isTelemetryManagedContact(saved)) return contact
  return {
    ...contact,
    name: saved.manualName ? saved.name : contact.name,
    className: saved.manualRecord && saved.className ? saved.className : contact.className,
    notes: saved.manualRecord && !isDefaultTelemetryNote(saved.notes) ? saved.notes : contact.notes,
    manualName: saved.manualName,
    manualRecord: saved.manualRecord,
  }
}

function bodyVisualRadius(contact: ShipContact, scale = mapScale, compactReference = false, bodyScaleMode: BodyScaleMode = 'tactical') {
  const physicalRadius = contact.radiusMeters ?? bodyRadiusMeters[contact.id]
  if (physicalRadius) {
    const rawRadius = physicalRadius * scale
    if (bodyScaleMode === 'true-scale') {
      if (compactReference) return clampNumber(rawRadius, isMoonBody(contact) ? 0.12 : 0.22, isMoonBody(contact) ? 1.05 : 5.8)
      return Math.max(rawRadius, isMoonBody(contact) ? 0.16 : 0.24)
    }
    if (compactReference) {
      return clampNumber(rawRadius, isMoonBody(contact) ? 0.36 : 0.92, isMoonBody(contact) ? 1.18 : 2.6)
    }
    return clampNumber(rawRadius, isMoonBody(contact) ? 0.42 : 1.05, isMoonBody(contact) ? 2.2 : 26)
  }
  if (isMoonBody(contact)) {
    if (contact.id === 'body-europa') return 0.58
    if (contact.id === 'body-mourning') return 0.64
    return 0.7
  }
  if (contact.id === 'body-helena') return 2.95
  if (contact.id === 'body-pelagos') return 2.72
  if (contact.id === 'body-ares') return 2.48
  if (contact.id === 'body-triton') return 1.58
  if (contact.id === 'body-pertam') return 1.82
  if (contact.kind === 'body') return 2.15
  return 0.82
}

function isMoonBody(contact: ShipContact) {
  return Boolean(bodyOrbitSpecs[contact.id]?.parentId)
}

function nonBodyVisualRadius(contact: ShipContact, selected: boolean) {
  const base = ['gps', 'waypoint', 'custom'].includes(contact.kind)
    ? 0.36
    : contact.kind === 'asteroid'
      ? 0.26
      : contact.kind === 'signal'
        ? 0.42
        : contact.kind === 'station'
          ? 0.66
          : 0.48
  return selected ? base * 1.38 : base
}

function createContactGeometry(contact: ShipContact, selected: boolean) {
  const radius = nonBodyVisualRadius(contact, selected)
  if (contact.kind === 'asteroid') return new THREE.DodecahedronGeometry(radius, 0)
  if (contact.kind === 'radar') return new THREE.TorusGeometry(radius * 0.9, Math.max(0.06, radius * 0.12), 8, 28)
  if (contact.kind === 'signal') return new THREE.TetrahedronGeometry(radius * 1.12, 0)
  if (contact.kind === 'gps' || contact.kind === 'waypoint' || contact.kind === 'custom') return new THREE.SphereGeometry(radius, 16, 16)
  return new THREE.OctahedronGeometry(radius, 0)
}

function moonVisualOrbitRadius(body: ShipContact, parent: ShipContact, scale = mapScale, bodyScaleMode: BodyScaleMode = 'tactical') {
  const rawRadius = planarDistanceMeters(parent, body) * scale
  if (!isMoonBody(body)) return Math.max(2.5, rawRadius)
  if (bodyScaleMode === 'true-scale') return Math.max(0.2, rawRadius)
  const padding = 9.8
  return Math.max(rawRadius, bodyVisualRadius(parent, scale, false, bodyScaleMode) + bodyVisualRadius(body, scale, false, bodyScaleMode) + padding)
}

type SystemMapProjection = {
  scale: number
  liveFocus: boolean
  bodyReferenceRangeMeters: number
}

const defaultSystemMapProjection: SystemMapProjection = {
  scale: mapScale,
  liveFocus: false,
  bodyReferenceRangeMeters: Number.POSITIVE_INFINITY,
}

type AsteroidMapCluster = {
  id: string
  contacts: ShipContact[]
  center: ShipCoordinate
  label: string
}

const asteroidClusterRangeMeters = 3000

function createAsteroidMapClusters(contacts: ShipContact[]): AsteroidMapCluster[] {
  const asteroids = contacts.filter((contact) => contact.kind === 'asteroid')
  const visited = new Set<string>()
  const clusters: AsteroidMapCluster[] = []

  asteroids.forEach((asteroid) => {
    if (visited.has(asteroid.id)) return
    const group: ShipContact[] = []
    const queue = [asteroid]
    visited.add(asteroid.id)

    while (queue.length) {
      const current = queue.shift()
      if (!current) continue
      group.push(current)

      asteroids.forEach((candidate) => {
        if (visited.has(candidate.id)) return
        if (distanceMeters(current, candidate) > asteroidClusterRangeMeters) return
        visited.add(candidate.id)
        queue.push(candidate)
      })
    }

    if (group.length < 2) return
    const center = group.reduce((total, contact) => ({
      x: total.x + contact.x / group.length,
      y: total.y + contact.y / group.length,
      z: total.z + contact.z / group.length,
    }), { x: 0, y: 0, z: 0 })
    const sorted = [...group].sort((left, right) => asteroidShortLabel(left).localeCompare(asteroidShortLabel(right), undefined, { numeric: true }))
    clusters.push({
      id: `asteroid-cluster-${sorted.map((contact) => contact.id).join('-')}`,
      contacts: sorted,
      center,
      label: `${asteroidShortLabel(sorted[0])} GROUP x${sorted.length}`,
    })
  })

  return clusters
}

function createSystemMapProjection(
  contacts: ShipContact[],
  currentPosition: ShipCoordinate,
  telemetryTrail: TelemetrySample[],
  projectedContact: ShipContact | null,
): SystemMapProjection {
  const liveFocus = telemetryTrail.some(hasTelemetryCoordinate)
  if (!liveFocus) return defaultSystemMapProjection

  const ranges = contacts
    .filter((contact) => contact.kind !== 'body')
    .map((contact) => distanceMeters(currentPosition, contact))
    .filter((range) => Number.isFinite(range) && range > 500)

  if (projectedContact && projectedContact.kind !== 'body') {
    const projectedRange = distanceMeters(currentPosition, projectedContact)
    if (Number.isFinite(projectedRange)) ranges.push(projectedRange)
  }

  const outerRange = clampNumber(
    Math.max(liveMapMinOuterRangeMeters, ...ranges),
    liveMapMinOuterRangeMeters,
    liveMapMaxOuterRangeMeters,
  )

  return {
    scale: liveMapTargetRadius / outerRange,
    liveFocus,
    bodyReferenceRangeMeters: Math.max(liveMapReferenceFloorMeters, outerRange * 1.35),
  }
}

function clampMapVector(position: THREE.Vector3, maxRadius: number) {
  if (!Number.isFinite(maxRadius)) return position
  const length = position.length()
  if (length <= maxRadius || length <= 0) return position
  return position.clone().multiplyScalar(maxRadius / length)
}

function displayContactPosition(
  contact: ShipContact,
  currentPosition: ShipCoordinate,
  projection: SystemMapProjection = defaultSystemMapProjection,
  bodyCatalog: ShipContact[] = starSystemBodies,
  bodyScaleMode: BodyScaleMode = 'tactical',
) {
  const basePosition = contactPosition(contact, currentPosition, projection.scale)
  if (projection.liveFocus && contact.kind === 'body') {
    return clampMapVector(basePosition, projection.bodyReferenceRangeMeters * projection.scale)
  }

  const spec = bodyOrbitSpecs[contact.id]
  if (!spec?.parentId) return basePosition
  const parent = bodyCatalog.find((candidate) => candidate.id === spec.parentId)
  if (!parent) return basePosition

  const parentPosition = contactPosition(parent, currentPosition, projection.scale)
  const offset = basePosition.clone().sub(parentPosition)
  const planarOffset = Math.hypot(offset.x, offset.z)
  const targetRadius = moonVisualOrbitRadius(contact, parent, projection.scale, bodyScaleMode)
  if (planarOffset <= 0 || planarOffset >= targetRadius) return basePosition

  const factor = targetRadius / planarOffset
  return new THREE.Vector3(
    parentPosition.x + offset.x * factor,
    parentPosition.y + offset.y,
    parentPosition.z + offset.z * factor,
  )
}

const planetSkinProfiles: Record<string, { base: string; low: string; high: string; cloud: string; accent: string }> = {
  'body-helena': { base: '#2f7f65', low: '#183d57', high: '#91d2a4', cloud: '#f1ead9', accent: '#68b4e8' },
  'body-mourning': { base: '#848c90', low: '#34383c', high: '#c5cdd2', cloud: '#a5adb3', accent: '#d49d72' },
  'body-ares': { base: '#b45737', low: '#522318', high: '#e29a67', cloud: '#d9b78b', accent: '#7b2d1e' },
  'body-europa': { base: '#d5d4c2', low: '#7a8f9c', high: '#fff7bd', cloud: '#eef4f4', accent: '#9bc8de' },
  'body-pelagos': { base: '#1d72a8', low: '#113250', high: '#71d2ff', cloud: '#e4fbff', accent: '#49d9be' },
  'body-vesper': { base: '#7659a8', low: '#293a5d', high: '#b393ff', cloud: '#d6c9f7', accent: '#5fc17a' },
  'body-triton': { base: '#6fb9cd', low: '#273d55', high: '#d6fbff', cloud: '#f0feff', accent: '#8e9ef5' },
  'body-pertam': { base: '#c47a42', low: '#4d2a1c', high: '#ffc071', cloud: '#d8a16b', accent: '#8c5a35' },
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let state = seed || 1
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return ((state >>> 0) / 4294967296)
  }
}

const planetTextureCache = new Map<string, THREE.CanvasTexture>()

function createPlanetTexture(contact: ShipContact) {
  const cacheKey = `${contact.id}:${contact.color}`
  const cached = planetTextureCache.get(cacheKey)
  if (cached) return cached
  const profile = planetSkinProfiles[contact.id] ?? { base: contact.color, low: '#1a2527', high: '#d6f3ea', cloud: '#eef5ed', accent: contact.color }
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = 512
  canvas.height = 256
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, profile.low)
    gradient.addColorStop(0.48, profile.base)
    gradient.addColorStop(1, profile.high)
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)

    const random = seededRandom(hashString(contact.id))
    const isMoon = isMoonBody(contact)
    const bandCount = isMoon ? 14 : 28
    for (let index = 0; index < bandCount; index += 1) {
      const y = random() * canvas.height
      const height = (isMoon ? 2 : 5) + random() * (isMoon ? 6 : 18)
      const alpha = 0.08 + random() * 0.16
      context.fillStyle = index % 3 === 0
        ? hexToRgba(profile.accent, alpha)
        : hexToRgba(index % 2 === 0 ? profile.high : profile.low, alpha)
      context.beginPath()
      for (let x = 0; x <= canvas.width; x += 14) {
        const wave = Math.sin((x + index * 17) / (32 + random() * 44)) * (4 + random() * 8)
        if (x === 0) context.moveTo(x, y + wave)
        else context.lineTo(x, y + wave)
      }
      context.lineTo(canvas.width, y + height)
      context.lineTo(0, y + height)
      context.closePath()
      context.fill()
    }

    const craterCount = isMoon ? 70 : contact.id === 'body-pertam' || contact.id === 'body-ares' ? 38 : 16
    for (let index = 0; index < craterCount; index += 1) {
      const x = random() * canvas.width
      const y = random() * canvas.height
      const radius = (isMoon ? 2.2 : 1.6) + random() * (isMoon ? 7 : 5)
      context.fillStyle = hexToRgba(profile.low, 0.18 + random() * 0.2)
      context.beginPath()
      context.ellipse(x, y, radius * (1.2 + random()), radius * 0.72, random() * Math.PI, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = hexToRgba(profile.high, 0.08)
      context.stroke()
    }

    if (!isMoon && contact.id !== 'body-pertam') {
      for (let index = 0; index < 22; index += 1) {
        const x = random() * canvas.width
        const y = random() * canvas.height
        context.strokeStyle = hexToRgba(profile.cloud, 0.16 + random() * 0.24)
        context.lineWidth = 2 + random() * 7
        context.beginPath()
        context.moveTo(x, y)
        context.bezierCurveTo(
          x + 40 + random() * 120,
          y - 24 + random() * 48,
          x + 110 + random() * 160,
          y - 18 + random() * 44,
          x + 220 + random() * 160,
          y + random() * 38 - 19,
        )
        context.stroke()
      }
    }

    const shade = context.createLinearGradient(0, 0, canvas.width, 0)
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.2)')
    shade.addColorStop(0.48, 'rgba(255, 255, 255, 0.08)')
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.24)')
    context.fillStyle = shade
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 4
  texture.userData.shipOsCached = true
  planetTextureCache.set(cacheKey, texture)
  return texture
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const normalized = clean.length === 3 ? clean.split('').map((value) => value + value).join('') : clean
  const value = Number.parseInt(normalized, 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function disposeMaterial(material?: THREE.Material | THREE.Material[]) {
  if (!material) return
  const materials = Array.isArray(material) ? material : [material]
  materials.forEach((item) => {
    const maybeTextured = item as THREE.Material & { map?: THREE.Texture }
    if (!maybeTextured.map?.userData.shipOsCached) maybeTextured.map?.dispose()
    item.dispose()
  })
}

function createBodyLabel(text: string, color: string, selected: boolean) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = 512
  canvas.height = 128
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(2, 7, 9, 0.82)'
    context.fillRect(92, 18, 328, 66)
    context.strokeStyle = color
    context.globalAlpha = selected ? 0.82 : 0.58
    context.strokeRect(92, 18, 328, 66)
    context.globalAlpha = 1
    context.font = '900 46px "IBM Plex Mono", "Share Tech Mono", monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.shadowColor = color
    context.shadowBlur = selected ? 18 : 10
    context.fillStyle = selected ? '#fff4d8' : '#f4eadb'
    context.fillText(text, canvas.width / 2, 58)
    context.shadowBlur = 0
    context.strokeStyle = color
    context.globalAlpha = selected ? 0.92 : 0.54
    context.beginPath()
    context.moveTo(154, 94)
    context.lineTo(358, 94)
    context.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    opacity: selected ? 1 : 0.84,
    transparent: true,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(17, 4.25, 1)
  sprite.renderOrder = 10
  return sprite
}

function createGpsCrosshairMarker(color: string, selected = false) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = 160
  canvas.height = 160
  if (context) {
    const center = canvas.width / 2
    const outer = selected ? 54 : 46
    const innerGap = selected ? 15 : 18
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.shadowColor = color
    context.shadowBlur = selected ? 22 : 16
    context.strokeStyle = color
    context.lineWidth = selected ? 8 : 6
    context.globalAlpha = selected ? 0.98 : 0.88
    context.beginPath()
    context.arc(center, center, outer * 0.62, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.moveTo(center - outer, center)
    context.lineTo(center - innerGap, center)
    context.moveTo(center + innerGap, center)
    context.lineTo(center + outer, center)
    context.moveTo(center, center - outer)
    context.lineTo(center, center - innerGap)
    context.moveTo(center, center + innerGap)
    context.lineTo(center, center + outer)
    context.stroke()
    context.shadowBlur = 0
    context.fillStyle = '#f4eadb'
    context.globalAlpha = selected ? 1 : 0.88
    context.beginPath()
    context.arc(center, center, selected ? 5 : 4, 0, Math.PI * 2)
    context.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    opacity: selected ? 1 : 0.94,
    sizeAttenuation: false,
    transparent: true,
  })
  const sprite = new THREE.Sprite(material)
  const size = selected ? 0.078 : 0.058
  sprite.scale.set(size, size, 1)
  sprite.renderOrder = selected ? 25 : 22
  return sprite
}

function setMapLabelScale(
  label: THREE.Sprite,
  width: number,
  height: number,
  minZoomScale = 0.34,
  maxZoomScale = 1.16,
  referenceDistance = 150,
) {
  const scaledWidth = width * mapLabelSizeMultiplier
  const scaledHeight = height * mapLabelSizeMultiplier
  label.scale.set(scaledWidth, scaledHeight, 1)
  label.userData.baseLabelScale = { x: scaledWidth, y: scaledHeight }
  label.userData.labelScaleLimits = { min: minZoomScale, max: maxZoomScale }
  label.userData.labelScaleReferenceDistance = referenceDistance
}

function updateMapLabelZoomScale(root: THREE.Object3D, camera: THREE.Camera, target: THREE.Vector3) {
  const distance = camera.position.distanceTo(target)
  root.traverse((object) => {
    const baseScale = object.userData.baseLabelScale as { x: number; y: number } | undefined
    if (!baseScale) return
    const limits = object.userData.labelScaleLimits as { min: number; max: number } | undefined
    const referenceDistance = Number(object.userData.labelScaleReferenceDistance) || 150
    const zoomScale = clampNumber(distance / referenceDistance, limits?.min ?? 0.34, limits?.max ?? 1.16)
    object.scale.set(baseScale.x * zoomScale, baseScale.y * zoomScale, 1)
  })
}

function disableMapPicking<T extends THREE.Object3D>(object: T) {
  object.raycast = () => undefined
  return object
}

function createHorizontalCirclePoints(radius: number, y = -0.08, segments = orbitLineSegments) {
  const points: THREE.Vector3[] = []
  for (let index = 0; index < segments; index += 1) {
    const theta = (index / segments) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius))
  }
  return points
}

function addDefenseEnvelope(
  markerGroup: THREE.Group,
  position: THREE.Vector3,
  mapProjectionScale: number,
  selected: boolean,
  color = '#3dff93',
  ranges = defenseEnvelopeRingsMeters,
) {
  ranges.forEach((rangeMeters, index) => {
    const radius = rangeMeters * mapProjectionScale
    if (radius < 0.56 || radius > 240) return
    const isInnerRing = index === 0
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 18),
      new THREE.MeshBasicMaterial({
        color,
        depthWrite: false,
        opacity: isInnerRing ? (selected ? 0.15 : 0.09) : (selected ? 0.095 : 0.052),
        transparent: true,
        wireframe: true,
      }),
    )
    shell.position.copy(position)
    shell.renderOrder = 2
    disableMapPicking(shell)
    markerGroup.add(shell)

    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(createHorizontalCirclePoints(radius, -0.06)),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: isInnerRing ? (selected ? 0.78 : 0.52) : (selected ? 0.56 : 0.34),
      }),
    )
    ring.position.copy(position)
    ring.renderOrder = 3
    ring.userData.defenseEnvelopeMeters = rangeMeters
    disableMapPicking(ring)
    markerGroup.add(ring)
  })
}

function createShipVectorGeometry(selected: boolean) {
  const geometry = new THREE.ConeGeometry(selected ? 0.94 : 0.78, selected ? 3.12 : 2.58, 3, 1)
  geometry.rotateX(Math.PI / 2)
  geometry.rotateZ(Math.PI / 6)
  return geometry
}

function latestShipVector(telemetryTrail: TelemetrySample[]) {
  const velocitySample = telemetryTrail.find((sample) => {
    const velocityMagnitude = Math.hypot(
      Number(sample.velocityX) || 0,
      Number(sample.velocityY) || 0,
      Number(sample.velocityZ) || 0,
    )
    return velocityMagnitude > 0.05
  })
  if (velocitySample) {
    return new THREE.Vector3(
      Number(velocitySample.velocityX) || 0,
      (Number(velocitySample.velocityY) || 0) * 0.72,
      Number(velocitySample.velocityZ) || 0,
    ).normalize()
  }

  const latestCoordinate = coordinateFromTelemetry(telemetryTrail[0] ?? {})
  const previousCoordinate = coordinateFromTelemetry(telemetryTrail[1] ?? {})
  if (latestCoordinate && previousCoordinate) {
    const travelVector = new THREE.Vector3(
      latestCoordinate.x - previousCoordinate.x,
      (latestCoordinate.y - previousCoordinate.y) * 0.72,
      latestCoordinate.z - previousCoordinate.z,
    )
    if (travelVector.lengthSq() > 0.0001) return travelVector.normalize()
  }

  return new THREE.Vector3(0, 0, 1)
}

function focusMapCameraOn(camera: THREE.PerspectiveCamera, controls: OrbitControls, focusPosition: THREE.Vector3) {
  const previousTarget = controls.target.clone()
  const shift = focusPosition.clone().sub(previousTarget)
  camera.position.add(shift)
  controls.target.copy(focusPosition)
  controls.update()
}

function createInitialWaves(): Wave[] {
  const now = Date.now()
  return [
    {
      id: 'wave-seed-meridian-final-invoice',
      direction: 'incoming',
      network: 'Independent Deep Space Beacons',
      from: 'Ares Meridian Naval Works',
      to: shipName,
      subject: 'Final refit invoice and certification',
      body: 'Final invoice: 1,981,440 credits against a 2,000,000 credit authorization ceiling. Localized dampening certification: PASS. Major refit package released for unrestricted operation.',
      createdAt: now - 420000,
      status: 'received',
      priority: 'priority',
      channel: 'ship-to-shore',
      contactName: 'Ares Meridian Naval Works',
      feesCredits: 1981440,
    },
    {
      id: 'wave-seed-continuity-credential',
      direction: 'incoming',
      network: 'Independent Deep Space Beacons',
      from: 'Ares Civil Continuity Network',
      to: 'Renn Harrow',
      subject: 'Provisional liaison credential',
      body: 'Renn Harrow is recognized for 90 days as a provisional liaison. This provides information and introductions only; it conveys no authority to commit Ares, Intrepid resources, aid, or funding.',
      createdAt: now - 300000,
      status: 'received',
      crewTarget: 'Renn Harrow',
      priority: 'routine',
      channel: 'wave',
    },
    {
      id: 'wave-seed-europa-manifest-lock',
      direction: 'incoming',
      network: 'Passenger Exchange',
      from: 'Mara Sennett',
      to: shipName,
      subject: 'Europa and Pelagos manifest lock',
      body: 'Manifest locked at 15 souls: eight crew and seven passengers. All six passenger cabins occupied. Sato disembarks Europa; Derrin Sol, Talia Or, Elias and Juno Marr, and Nadia Kess continue toward Pelagos.',
      createdAt: now - 220000,
      status: 'received',
      crewTarget: 'Mara Sennett',
      priority: 'routine',
      channel: 'wave',
    },
    {
      id: 'wave-seed-refit-proving-order',
      direction: 'incoming',
      network: 'Independent Deep Space Beacons',
      from: 'Toren Vask / Engineering',
      to: shipName,
      subject: 'Post-refit proving watch',
      body: 'Zero grounding squawks. Four open and six watch items do not affect operations. Engineering requests approximately 50 operating hours before declaring the entire Meridian refit fully proven.',
      createdAt: now - 160000,
      status: 'received',
      crewTarget: 'Toren Vask',
      priority: 'priority',
      channel: 'wave',
    },
    {
      id: 'wave-seed-relay-e17-prospect',
      direction: 'incoming',
      network: 'Independent Deep Space Beacons',
      from: 'Europa contract exchange',
      to: shipName,
      subject: 'Relay E-17 overdue maintenance posting',
      body: 'Automated navigation relay E-17 is advertising overdue maintenance. This posting remains a prospect only. No acceptance, dispatch, rescue obligation, or aid commitment has been recorded.',
      createdAt: now - 90000,
      status: 'received',
      priority: 'routine',
      channel: 'ship-to-shore',
      contactName: 'Relay E-17',
    },
  ]
}

function createInitialLogs(): ShipLog[] {
  const now = Date.now()
  const captainLogs: Array<[string, string]> = [
    ['001 - Leaving', 'Hales left Covenant service after twelve years, received the Intrepid from Edicarus, operated alone for three weeks, and followed an old signal toward Carthage.'],
    ['002 - Asterion', 'After twelve weeks from Lunar Transit Station 34-A, Intrepid found Carthage alive, contacted Marshal Elara Voss, docked at Asterion, and began looking for crew and work.'],
    ['003 - Mara', 'Mara Sennett became First Officer at 3,000 credits monthly with authority to run the business and challenge command.'],
    ['004 - Crew', 'Kessa, Selene, Toren, Garran, Luca, and eventually Renn joined Hales and Mara. What began as hiring became an eight-person household.'],
    ['005 - Medical', 'The empty medical compartment became an advanced clinic. The first real contract was a 118,000 credit Helena-to-Ares transfer for two critical patients.'],
    ['006 - First Passengers', 'Iria, Derrin, Mother Calen, Renn, Lysa, Tomas, and Sera taught the Intrepid how to operate as a passenger ship.'],
    ['007 - Helena', 'Every department supported the patient-safe Helena pickup and nineteen-hour non-FTL passage. Both patients reached Ares alive.'],
    ['008 - Father', 'Edicarus created a 10,000,000 credit provisional relief authority, gathered 43 volunteers and three interested ships, and ordered that nobody move before need was verified.'],
    ['009 - Ares', 'The patients survived, the client paid, liberty was taken, and the first mission closed without death, violence, or ship damage.'],
    ['010 - The Scar', 'Meridian restored the old port-spine combat wound internally while preserving the reinforced exterior scar as a command reminder.'],
    ['011 - Refit', 'The 1,981,440 credit Meridian package delivered dampening, FTL isolation, actuators, redundancy, Medical power, passenger safety, Mission Bay utilities, sensors, and ABIGAIL.'],
    ['012 - ABIGAIL', 'ABIGAIL Mk VII entered supervised operations with clear Flight, Engineering, Tactical, FTL, and Medical boundaries plus a physical Isolation Control.'],
    ['013 - ShipOS', 'Department requests transformed ShipOS into institutional memory under Mara\'s rule: one truth, multiple views.'],
    ['014 - Renn', 'Renn moved from passenger to Survey & Field Liaison at 2,500 credits monthly, responsible for finding evidence and saying when help is not needed.'],
    ['015 - The Intrepid as Home', 'Hales recalled the bridge blanket that first made Intrepid feel like home and accepted that one person can survive aboard, but a crew makes a life.'],
    ['016 - Why Mara Came', 'Mara stayed because Intrepid felt like the beginning of something and because Hales treated the ship as a home rather than collateral.'],
    ['017 - Ares Continuity', 'Ares Civil Continuity connected Renn to a 90-day provisional liaison credential carrying contacts and information but no commitment authority.'],
    ['018 - Just Help', 'Hales defined the endeavor plainly: this family keeps helping, with evidence and dignity rather than spectacle.'],
    ['019 - Do Not Become the Mission', 'The crew adopted doctrine that Intrepid must remain a home, not become an exhausted relief warehouse where every person and flight is an emergency.'],
    ['020 - Nadia Kess', 'Nadia boarded at Ares as a paid Pelagos passenger, investigative journalist, and independent observer interested in infrastructure, institutions, and Hales.'],
    ['021 - The Comms Room', 'Hales showed Nadia the old sleeping cubby and preserved scar; she observed that he speaks of Intrepid as though they survived each other.'],
    ['022 - Dinner', 'Hales invited Nadia to a private, off-record dinner in his quarters. She arrived without a recorder and the evening remained personal.'],
    ['023 - Father', 'A story about Edicarus reinforced the principle that dignity begins by letting people say what they need. Nadia suggested becoming someone safe to ask.'],
    ['024 - Scraps', 'Nadia challenged Hales to distinguish between fights nobody will take, fights that are not his, and resistance he has failed to recognize.'],
    ['025 - The Interview', 'Nadia sees a household-based institution built around distributed authority and trust, while watching carefully for cult-of-personality risk.'],
    ['026 - Who Am I?', 'Nadia separated who Hales is from what he is for and pointed to choices made without duty, rescue, or command as a possible answer.'],
    ['027 - Nadia', 'The dinner ended without forcing a definition. The next morning was outwardly normal, with an acknowledged but deliberately undefined connection.'],
    ['028 - Europa Run', 'Intrepid departed Ares for Europa with eight crew, seven passengers, ABIGAIL online, a healthy ship, and a three-day layover planned before Pelagos.'],
    ['029 - Current Orders', 'Reach Europa safely, deliver passengers, inspect the refit, let Renn learn without promises, take liberty, find useful work, protect profitability, and remember Intrepid is home.'],
    ['030 - Intrepid', 'The voyage began with one man, money, weapons, empty cabins, and no plan. It now carries eight crew and fifteen souls toward Europa, and Hales knows where home is.'],
  ]
  return captainLogs.map(([title, entry], index) => ({
    id: `log-seed-captain-${String(index + 1).padStart(3, '0')}`,
    stamp: now - ((captainLogs.length - index) * 60000),
    system: 'CAPTAIN',
    entry: `${title}: ${entry}`,
  }))
}

function createInitialBankEntries(): BankEntry[] {
  const today = currentIsoDate()
  return [
    {
      id: 'bank-seed-operating-account',
      date: today,
      kind: 'income',
      vendor: 'Hales operating account',
      category: 'Operating Capital',
      amount: operatingAccountInitialCredits,
      recurring: false,
      notes: 'Dedicated Intrepid venture operating account.',
    },
    {
      id: 'bank-seed-mara-upfront',
      date: today,
      kind: 'expense',
      vendor: 'Mara Sennett',
      category: 'Payroll',
      amount: 6000,
      recurring: false,
      notes: 'Two months First Officer salary paid upfront.',
    },
    {
      id: 'bank-seed-mara-monthly',
      date: today,
      kind: 'expense',
      vendor: 'Mara Sennett',
      category: 'Recurring Payroll',
      amount: 3000,
      recurring: true,
      notes: 'Monthly First Officer compensation.',
    },
    {
      id: 'bank-seed-core-crew-upfront',
      date: today,
      kind: 'expense',
      vendor: 'Kessa / Selene / Toren / Garran / Luca',
      category: 'Payroll',
      amount: 25000,
      recurring: false,
      notes: 'Two months upfront for five active specialists at 5,000 credits each.',
    },
    {
      id: 'bank-seed-core-crew-monthly',
      date: today,
      kind: 'expense',
      vendor: 'Crew specialist payroll',
      category: 'Recurring Payroll',
      amount: 15000,
      recurring: true,
      notes: 'Kessa, Selene, Toren, Garran, Luca, and Renn at 2,500 credits/month each.',
    },
    {
      id: 'bank-seed-medical-conversion',
      date: today,
      kind: 'expense',
      vendor: 'Asterion medical contractors',
      category: 'Completed Medical Conversion',
      amount: 276000,
      recurring: false,
      notes: 'Historic completed shipboard clinic, trauma OR, AutoSurgDoc, recovery, isolation, advanced diagnostics, and cryogenic capability.',
    },
    {
      id: 'bank-seed-meridian-refit',
      date: today,
      kind: 'expense',
      vendor: 'Ares Meridian Naval Works',
      category: 'Major Civilian Refit',
      amount: 1981440,
      recurring: false,
      notes: 'Final paid cost against a 2,000,000 credit authorization ceiling.',
    },
    {
      id: 'bank-seed-medical-contract-paid',
      date: today,
      kind: 'income',
      vendor: 'Helena Medical Authority',
      category: 'Completed Contract Revenue',
      amount: 118000,
      recurring: false,
      notes: 'First paid mission completed. Fuel reimbursement is not included in this line.',
    },
  ]
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function normalizeWaveChannel(wave: Pick<Wave, 'channel'>): WaveChannel {
  return wave.channel ?? 'wave'
}

function normalizeWavePriority(wave: Pick<Wave, 'priority'>): WavePriority {
  return wave.priority ?? 'routine'
}

function waveChannelLabel(channel?: WaveChannel) {
  const normalized = channel ?? 'wave'
  return waveChannelOptions.find((option) => option.id === normalized)?.label ?? normalized
}

function wavePriorityLabel(priority?: WavePriority) {
  const normalized = priority ?? 'routine'
  return wavePriorityOptions.find((option) => option.id === normalized)?.label ?? normalized
}

function isHailChannel(channel?: WaveChannel) {
  const normalized = channel ?? 'wave'
  return normalized === 'hail' || normalized === 'ship-to-ship' || normalized === 'ship-to-shore' || normalized === 'docking'
}

function baseWaveSubject(subject: string) {
  return subject.replace(/^re:\s*/i, '').trim() || 'Untitled Wave'
}

function waveThreadKey(wave: Wave) {
  return [
    wave.network.trim().toLowerCase(),
    wave.crewTarget || 'ship',
    wave.contactId || wave.contactName || '',
    baseWaveSubject(wave.subject).toLowerCase(),
  ].join('|')
}

function waveMatchesFolder(wave: Wave, folder: EchoMailFolder) {
  if (folder === 'all') return true
  if (folder === 'inbox') return wave.direction === 'incoming'
  if (folder === 'sent') return wave.direction === 'outgoing'
  if (folder === 'pending') return wave.status === 'awaiting-response'
  if (folder === 'hails') return isHailChannel(wave.channel)
  return true
}

function waveMatchesSearch(wave: Wave, searchText: string) {
  const terms = normalizeContactSearchText(searchText).split(' ').filter(Boolean)
  if (!terms.length) return true
  const haystack = [
    wave.network,
    wave.from,
    wave.to,
    wave.subject,
    wave.body,
    wave.crewTarget,
    wave.contactName,
    wavePriorityLabel(wave.priority),
    waveChannelLabel(wave.channel),
    wave.clearanceStatus,
  ].map((value) => String(value || '')).join(' ').toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

function createEchoMailThreads(waves: Wave[], folder: EchoMailFolder, searchText: string): EchoMailThread[] {
  const groups = new Map<string, Wave[]>()
  waves
    .filter((wave) => waveMatchesFolder(wave, folder) && waveMatchesSearch(wave, searchText))
    .forEach((wave) => {
      const key = waveThreadKey(wave)
      groups.set(key, [...(groups.get(key) ?? []), wave])
    })

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((left, right) => right.createdAt - left.createdAt)
      const latest = sorted[0]
      return {
        key,
        waves: sorted,
        latest,
        pendingCount: sorted.filter((wave) => wave.status === 'awaiting-response').length,
        incomingCount: sorted.filter((wave) => wave.direction === 'incoming').length,
        priority: normalizeWavePriority(latest),
        channel: normalizeWaveChannel(latest),
        contactId: latest.contactId,
        contactName: latest.contactName,
      }
    })
    .sort((left, right) => right.latest.createdAt - left.latest.createdAt)
}

function echoMailFolderCounts(waves: Wave[]) {
  return echoMailFolders.reduce((counts, folder) => {
    counts[folder.id] = waves.filter((wave) => waveMatchesFolder(wave, folder.id)).length
    return counts
  }, {} as Record<EchoMailFolder, number>)
}

function waveSnippet(body: string) {
  const clean = body.replace(/\s+/g, ' ').trim()
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean
}

function waveTimeLabel(stamp: number) {
  return new Date(stamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function dockingFeeForWave(wave: Wave) {
  if (wave.feesCredits && wave.feesCredits > 0) return wave.feesCredits
  const channel = normalizeWaveChannel(wave)
  const base = channel === 'docking' ? 3200 : channel === 'ship-to-shore' ? 2200 : channel === 'hail' ? 800 : 0
  if (!base) return 0
  const variation = hashString(`${wave.network}-${wave.to}-${wave.subject}`) % 2800
  return Math.round((base + variation) / 50) * 50
}

function relayNetworkForContact(contact: ShipContact) {
  const faction = contactFactionName(contact)
  if (relayNetworks.includes(faction)) return faction
  const haystack = `${contact.name} ${contact.className} ${contact.status} ${contact.notes} ${faction}`.toLowerCase()
  if (haystack.includes('asterion') || haystack.includes('helena')) return 'Asterion Orbital Traffic'
  if (haystack.includes('passenger')) return 'Passenger Exchange'
  if (haystack.includes('marshal')) return 'Marshal Voss District Net'
  if (haystack.includes('guild')) return 'Local Flight Guild'
  if (haystack.includes('covenant')) return 'Covenant Comms System'
  if (haystack.includes('oldearth') || haystack.includes('old earth')) return 'OldEarth Relay Network'
  return relayNetworks[0]
}

function recipientForHailTarget(contact: ShipContact) {
  const title = contactFileTitle(contact)
  if (contact.kind === 'body') return `${title} Surface Control`
  if (contact.kind === 'ship') return title
  if (contact.kind === 'relay') return title
  if (contact.kind === 'station') return `${title} Traffic Control`
  return `${title} Control`
}

function channelForHailTarget(contact: ShipContact): WaveChannel {
  if (contact.kind === 'ship') return 'ship-to-ship'
  if (contact.kind === 'body') return 'ship-to-shore'
  if (contact.kind === 'station') return 'docking'
  return 'hail'
}

function hailableContact(contact: ShipContact) {
  if (contact.id === currentShipContactId || contact.kind === 'asteroid' || contact.kind === 'gps') return false
  return ['body', 'relay', 'ship', 'station', 'signal', 'custom', 'waypoint', 'radar'].includes(contact.kind)
}

function hailRangeState(distance: number) {
  if (distance <= 8000) return 'Inside defense traffic envelope'
  if (distance <= 50000) return 'Local control space'
  if (distance <= 250000) return 'Approach-control range'
  return 'Long-range wave'
}

function createHailDraftForContact(contact: ShipContact, currentPosition: ShipCoordinate): WaveDraft {
  const title = contactFileTitle(contact)
  const channel = channelForHailTarget(contact)
  const purpose = channel === 'docking'
    ? 'berthing clearance'
    : channel === 'ship-to-shore'
      ? 'landing rights'
      : channel === 'ship-to-ship'
        ? 'traffic coordination'
        : 'channel handshake'
  const distance = distanceMeters(currentPosition, contact)
  const network = relayNetworkForContact(contact)
  return {
    network,
    to: recipientForHailTarget(contact),
    subject: `Hail: ${title} ${purpose}`,
    body: [
      `${shipName} to ${recipientForHailTarget(contact)}.`,
      `Requesting ${purpose} for DSV Intrepid.`,
      `Current GPS ${formatCoord(currentPosition.x)}:${formatCoord(currentPosition.y)}:${formatCoord(currentPosition.z)}; contact range ${formatKm(distance)}.`,
      'Registry: independent DSV Intrepid. Current declared profile: medical transfer / civilian passenger operations.',
      'Please advise approach corridor, pad or berth assignment, local fees, transponder requirements, and any weapons-safe or customs constraints.',
    ].join(' '),
    crewTarget: '',
    priority: channel === 'docking' || channel === 'ship-to-shore' ? 'priority' : 'routine',
    channel,
    contactId: contact.id,
  }
}

function generateRelayReply(wave: Wave): Wave {
  const channel = normalizeWaveChannel(wave)
  if (isHailChannel(channel)) {
    const fee = dockingFeeForWave(wave)
    const hash = hashString(`${wave.id}-${wave.subject}-${wave.to}`)
    const corridor = ['Blue Five', 'Copper Two', 'Green Nine', 'Amber Three', 'White Seven'][hash % 5]
    const hold = ['10 km high gate', 'outer beacon stack', 'ring shadow lane', 'north traffic cone', 'customs buoy'][Math.floor(hash / 5) % 5]
    const berth = ['Port 17 auxiliary', 'Pad C-12', 'Berth 4 Low', 'Hangar South Two', 'surface marker Theta'][Math.floor(hash / 25) % 5]
    const squawk = String((hash % 7000) + 1000).padStart(4, '0')
    const authority = wave.to || wave.network
    const feeLine = fee ? `Estimated local fees: ${formatCredits(fee)} pending manifest review.` : 'No fee table was attached to this channel.'
    const clearanceStatus: Wave['clearanceStatus'] = channel === 'docking' || channel === 'ship-to-shore' ? 'Negotiating' : 'Granted'
    return {
      id: `wave-reply-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      direction: 'incoming',
      network: wave.network,
      from: authority,
      to: wave.from,
      subject: `Re: ${baseWaveSubject(wave.subject)}`,
      body: `${authority} acknowledges ${shipName}. Provisional corridor ${corridor}; hold at ${hold}; expected assignment ${berth}; transponder ${squawk}. ${feeLine} Confirm final passenger count, hazardous cargo status, weapons safed posture, and medical priority before final clearance.`,
      createdAt: Date.now(),
      status: 'received',
      crewTarget: wave.crewTarget,
      priority: wave.priority,
      channel,
      contactId: wave.contactId,
      contactName: wave.contactName,
      clearanceStatus,
      feesCredits: fee || undefined,
    }
  }

  const opening = wave.network.includes('Covenant')
    ? 'EchoAtlas confirms receipt.'
    : wave.network.includes('OldEarth')
      ? 'OldEarth switchboard has routed the packet.'
      : wave.network.includes('Marshal')
        ? 'District net confirms receipt.'
        : wave.network.includes('Guild')
          ? 'Flight Guild desk has marked the request.'
          : wave.network.includes('Passenger')
            ? 'Passenger exchange has posted a reply.'
            : wave.network.includes('Asterion')
              ? 'Asterion traffic has acknowledged the wave.'
              : 'Deep-space carrier has resolved the packet.'
  const detail = [
    'No immediate threat markers are attached.',
    'A follow-up courier window has been reserved.',
    'The attached request has been mirrored to bridge logs.',
    'A short telemetry bundle is available on request.',
  ]

  return {
    id: `wave-reply-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    direction: 'incoming',
    network: wave.network,
    from: wave.to,
    to: wave.from,
    subject: `Re: ${wave.subject}`,
    body: `${opening} ${randomItem(detail)} Original wave: "${wave.body.slice(0, 90)}"`,
    createdAt: Date.now(),
    status: 'received',
    crewTarget: wave.crewTarget,
    priority: wave.priority,
    channel: wave.channel,
    contactId: wave.contactId,
    contactName: wave.contactName,
  }
}

function createRandomWave(crewMembers: CrewMember[]): Wave {
  const network = randomItem(relayNetworks)
  const target = Math.random() > 0.45 ? randomItem(crewMembers) : undefined
  const senders = ['Asterion Traffic Control', 'The Copper Wake', 'Passenger Exchange', 'Local Flight Guild', 'Unknown old telemetry source']
  const subjects = ['Docking lane update', 'Telemetry request', 'Passenger query', 'Crew applicant note', 'Navigation advisory']
  const bodyLines = [
    'Asterion requests a brief position confidence update.',
    'A station runner says an old packet drifted through the entry beacon again.',
    'A passenger broker has one risky long-haul inquiry and requests rate confirmation.',
    'A guild clerk has a candidate asking whether the Intrepid accepts immediate boarding.',
    'A chart fragment references a quiet jump window and a possible derelict.',
  ]

  return {
    id: `wave-random-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    direction: 'incoming',
    network,
    from: randomItem(senders),
    to: target?.name ?? shipName,
    subject: randomItem(subjects),
    body: randomItem(bodyLines),
    createdAt: Date.now(),
    status: 'received',
    crewTarget: target?.name,
    priority: Math.random() > 0.82 ? 'priority' : 'routine',
    channel: network.includes('Traffic') ? 'hail' : 'wave',
  }
}

function contactPosition(contact: ShipCoordinate, currentPosition: ShipCoordinate, scale = mapScale) {
  return new THREE.Vector3(
    (contact.x - currentPosition.x) * scale,
    (contact.y - currentPosition.y) * scale * 0.72,
    (contact.z - currentPosition.z) * scale,
  )
}

function ShipSystemMap({
  contacts,
  encounterMemory,
  systemBodies,
  currentPosition,
  currentShipContact,
  flightRoutes,
  focusContactId,
  focusRequestId,
  projectedContact,
  selectedContactId,
  bodyScaleMode,
  cameraMode,
  onSelectContact,
  telemetryTrail,
}: {
  contacts: ShipContact[]
  encounterMemory: EncounterMemoryContact[]
  systemBodies: ShipContact[]
  currentPosition: ShipCoordinate
  currentShipContact: ShipContact
  flightRoutes: FlightRoutePlan[]
  focusContactId: string
  focusRequestId: number
  projectedContact: ShipContact | null
  selectedContactId: string | null
  bodyScaleMode: BodyScaleMode
  cameraMode: MapCameraMode
  onSelectContact: (id: string) => void
  telemetryTrail: TelemetrySample[]
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const markerGroupRef = useRef<THREE.Group | null>(null)
  const focusedContactIdRef = useRef<string | null>(null)
  const focusedPositionRef = useRef<THREE.Vector3 | null>(null)
  const focusedRequestRef = useRef(0)
  const cameraModeRef = useRef<MapCameraMode>('overhead')
  const overheadCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#020507')

    const camera = new THREE.PerspectiveCamera(54, 1, 0.05, 2200)
    camera.position.set(0, 72, 148)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.zoomSpeed = 1.05
    controls.panSpeed = 1.12
    controls.minDistance = 1.35
    controls.maxDistance = 760

    const markerGroup = new THREE.Group()
    scene.add(markerGroup)

    const ambient = new THREE.AmbientLight('#9adbcf', 0.48)
    scene.add(ambient)
    const key = new THREE.PointLight('#7de8d2', 3.1, 520)
    key.position.set(28, 58, 24)
    scene.add(key)
    const rim = new THREE.DirectionalLight('#f6b94d', 1.1)
    rim.position.set(-42, 36, -60)
    scene.add(rim)

    const grid = new THREE.GridHelper(340, 34, '#31534f', '#182623')
    grid.position.y = -0.2
    scene.add(grid)

    const starPositions: number[] = []
    for (let index = 0; index < 900; index += 1) {
      const a = index * 12.9898
      const b = index * 78.233
      const x = (Math.sin(a) * 43758.5453 % 1) * 520
      const y = (Math.sin(b) * 24634.6345 % 1) * 340
      const z = (Math.cos(a + b) * 34654.223 % 1) * 520
      starPositions.push(x, y, z)
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#f1e2c6', size: 0.72, transparent: true, opacity: 0.78 })))

    const resize = () => {
      const width = Math.max(320, mount.clientWidth)
      const height = Math.max(180, mount.clientHeight)
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    let animationFrame = 0
    const animate = () => {
      if (document.hidden) {
        animationFrame = 0
        return
      }
      controls.update()
      markerGroup.children.forEach((child) => {
        if (typeof child.userData.spinRate === 'number') child.rotation.y += child.userData.spinRate
      })
      updateMapLabelZoomScale(markerGroup, camera, controls.target)
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(animate)
    }
    const startAnimation = () => {
      if (!document.hidden && animationFrame === 0) animationFrame = window.requestAnimationFrame(animate)
    }
    const handleVisibilityChange = () => {
      if (document.hidden && animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      } else {
        startAnimation()
      }
    }
    startAnimation()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerDownPosition: { x: number; y: number } | null = null
    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPosition = { x: event.clientX, y: event.clientY }
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerDownPosition) return
      const movement = Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y)
      pointerDownPosition = null
      if (movement > 6) return

      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const intersections = raycaster.intersectObjects(markerGroup.children, false)
      const contactId = intersections.find((item) => typeof item.object.userData.contactId === 'string')?.object.userData.contactId
      if (typeof contactId === 'string') {
        onSelectContact(contactId)
      }
    }
    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointerup', handlePointerUp)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    controlsRef.current = controls
    markerGroupRef.current = markerGroup

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      scene.clear()
    }
  }, [onSelectContact])

  useEffect(() => {
    const markerGroup = markerGroupRef.current
    if (!markerGroup) return

    markerGroup.children.forEach((child) => {
      const object = child as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] }
      object.geometry?.dispose()
      disposeMaterial(object.material)
    })
    markerGroup.clear()

    const selectedContact = selectedContactId === currentShipContact.id
      ? currentShipContact
      : contacts.find((contact) => contact.id === selectedContactId) ?? null
    const focusedContact = focusContactId === currentShipContact.id
      ? currentShipContact
      : contacts.find((contact) => contact.id === focusContactId) ?? currentShipContact
    const mapProjection = createSystemMapProjection(contacts, currentPosition, telemetryTrail, projectedContact)
    const shipVector = latestShipVector(telemetryTrail)
    const projectedFlightVector = projectedContact && projectedContact.id !== currentShipContact.id
      ? displayContactPosition(projectedContact, currentPosition, mapProjection, systemBodies, bodyScaleMode)
      : null
    const forwardDirection = projectedFlightVector && projectedFlightVector.lengthSq() > 0.0001
      ? projectedFlightVector.clone().normalize()
      : shipVector.clone()
    const focusedPosition = focusedContact.id === currentShipContact.id
      ? new THREE.Vector3(0, 0, 0)
      : displayContactPosition(focusedContact, currentPosition, mapProjection, systemBodies, bodyScaleMode)
    const controls = controlsRef.current
    const camera = cameraRef.current
    const previousCameraMode = cameraModeRef.current
    if (controls && camera && cameraMode === 'overhead' && previousCameraMode === 'forward') {
      controls.enabled = true
      camera.fov = 54
      camera.up.set(0, 1, 0)
      if (overheadCameraRef.current) {
        camera.position.copy(overheadCameraRef.current.position)
        controls.target.copy(overheadCameraRef.current.target)
      } else {
        camera.position.set(0, 72, 148)
        controls.target.set(0, 0, 0)
      }
      camera.updateProjectionMatrix()
      controls.update()
    }
    const shouldRefocus = focusedContactIdRef.current !== focusedContact.id
      || focusedRequestRef.current !== focusRequestId
      || !focusedPositionRef.current
      || focusedPositionRef.current.distanceToSquared(focusedPosition) > 0.0001
    if (controls && camera && cameraMode === 'overhead' && shouldRefocus) {
      focusMapCameraOn(camera, controls, focusedPosition)
      focusedContactIdRef.current = focusedContact.id
      focusedPositionRef.current = focusedPosition.clone()
      focusedRequestRef.current = focusRequestId
    }
    if (controls && camera && cameraMode === 'forward') {
      if (previousCameraMode !== 'forward') {
        overheadCameraRef.current = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        }
      }
      const lookDistance = clampNumber(projectedFlightVector?.length() ?? 120, 48, 220)
      camera.position.copy(forwardDirection).multiplyScalar(2.4)
      camera.position.y += 0.68
      controls.target.copy(forwardDirection).multiplyScalar(lookDistance)
      controls.enabled = false
      camera.fov = 66
      camera.up.set(0, 1, 0)
      camera.lookAt(controls.target)
      camera.updateProjectionMatrix()
    }
    cameraModeRef.current = cameraMode
    const orbitMaterial = new THREE.LineBasicMaterial({ color: '#31534f', transparent: true, opacity: 0.46 })
    const moonOrbitMaterial = new THREE.LineBasicMaterial({ color: '#6b8790', transparent: true, opacity: 0.38 })

    if (mapProjection.liveFocus) {
      liveMapRangeRingsMeters.forEach((rangeMeters) => {
        const radius = rangeMeters * mapProjection.scale
        if (radius < 0.8 || radius > 240) return
        const points: THREE.Vector3[] = []
        for (let index = 0; index < orbitLineSegments; index += 1) {
          const theta = (index / orbitLineSegments) * Math.PI * 2
          points.push(new THREE.Vector3(Math.cos(theta) * radius, -0.18, Math.sin(theta) * radius))
        }
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: '#31534f', transparent: true, opacity: rangeMeters <= 8000 ? 0.42 : rangeMeters === 250000 ? 0.46 : 0.34 }),
        )
        disableMapPicking(ring)
        ring.userData.rangeGuide = rangeMeters
        markerGroup.add(ring)

        const label = createBodyLabel(formatKm(rangeMeters), '#6b8790', false)
        setMapLabelScale(label, rangeMeters <= 8000 ? 3.5 : 4.9, rangeMeters <= 8000 ? 0.86 : 1.2, 0.28, 1.05)
        label.position.set(radius + 2.6, 0.9, 0)
        disableMapPicking(label)
        markerGroup.add(label)
      })
    } else {
      systemBodies.forEach((body) => {
        const spec = bodyOrbitSpecs[body.id]
        if (!spec?.parentId) return
        const parent = systemBodies.find((candidate) => candidate.id === spec.parentId)
        if (!parent) return
        const center = contactPosition(parent, currentPosition, mapProjection.scale)
        const radius = moonVisualOrbitRadius(body, parent, mapProjection.scale, bodyScaleMode)
      const points: THREE.Vector3[] = []
      for (let index = 0; index < orbitLineSegments; index += 1) {
        const theta = (index / orbitLineSegments) * Math.PI * 2
        points.push(new THREE.Vector3(
          center.x + Math.cos(theta) * radius,
          center.y - 0.12,
          center.z + Math.sin(theta) * radius,
        ))
      }
      const orbit = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        spec.guide.includes('moon') || spec.guide.includes('companion') ? moonOrbitMaterial.clone() : orbitMaterial.clone(),
      )
      disableMapPicking(orbit)
      orbit.userData.orbitGuide = body.id
      markerGroup.add(orbit)
      })
    }
    orbitMaterial.dispose()
    moonOrbitMaterial.dispose()

    const shipSelected = selectedContactId === currentShipContact.id
    const shipGeometry = createShipVectorGeometry(shipSelected)
    const shipMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7de8d2', emissiveIntensity: shipSelected ? 1.1 : 0.7 })
    const ship = new THREE.Mesh(shipGeometry, shipMaterial)
    ship.position.set(0, 0, 0)
    ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), shipVector)
    ship.userData.contactId = currentShipContact.id
    markerGroup.add(ship)

    const shipVectorEnd = shipVector.clone().multiplyScalar(shipSelected ? 7.2 : 5.4)
    shipVectorEnd.y += 0.05
    const shipVectorLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.05, 0), shipVectorEnd]),
      new THREE.LineBasicMaterial({ color: '#3dff93', transparent: true, opacity: shipSelected ? 0.82 : 0.58 }),
    )
    shipVectorLine.renderOrder = 6
    disableMapPicking(shipVectorLine)
    markerGroup.add(shipVectorLine)

    const shipGlow = new THREE.Mesh(
      new THREE.SphereGeometry(shipSelected ? 5.2 : 4.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: '#3dff93',
        depthWrite: false,
        opacity: shipSelected ? 0.2 : 0.13,
        transparent: true,
      }),
    )
    disableMapPicking(shipGlow)
    markerGroup.add(shipGlow)

    const shipOuterGlow = new THREE.Mesh(
      new THREE.SphereGeometry(shipSelected ? 8.2 : 7.2, 32, 32),
      new THREE.MeshBasicMaterial({
        color: '#3dff93',
        depthWrite: false,
        opacity: shipSelected ? 0.08 : 0.052,
        transparent: true,
      }),
    )
    disableMapPicking(shipOuterGlow)
    markerGroup.add(shipOuterGlow)

    addDefenseEnvelope(markerGroup, new THREE.Vector3(0, 0, 0), mapProjection.scale, shipSelected)

    const shipRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 72 }, (_, index) => {
        const theta = (index / 72) * Math.PI * 2
        return new THREE.Vector3(Math.cos(theta) * 3.2, -0.06, Math.sin(theta) * 3.2)
      })),
      new THREE.LineBasicMaterial({ color: '#3dff93', transparent: true, opacity: shipSelected ? 0.92 : 0.62 }),
    )
    disableMapPicking(shipRing)
    markerGroup.add(shipRing)

    const shipLabel = createBodyLabel('YOU / INTREPID', '#3dff93', shipSelected)
    setMapLabelScale(shipLabel, 8.6, 2.12, 0.3, 1)
    shipLabel.position.set(0, 5.8, 0)
    disableMapPicking(shipLabel)
    markerGroup.add(shipLabel)

    const shipPickRadius = shipSelected ? 1.78 : 1.38
    const shipHitArea = new THREE.Mesh(
      new THREE.SphereGeometry(shipPickRadius, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#7de8d2', depthWrite: false, opacity: 0, transparent: true }),
    )
    shipHitArea.userData.contactId = currentShipContact.id
    markerGroup.add(shipHitArea)

    const trailCoordinates = telemetryTrail
      .map(coordinateFromTelemetry)
      .filter(Boolean)
      .reverse() as ShipCoordinate[]
    if (trailCoordinates.length > 1) {
      const trailPoints = trailCoordinates.map((coordinate) => contactPosition(coordinate, currentPosition, mapProjection.scale))
      const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints)
      const trailMaterial = new THREE.LineBasicMaterial({ color: '#7de8d2', transparent: true, opacity: 0.78 })
      const trail = new THREE.Line(trailGeometry, trailMaterial)
      disableMapPicking(trail)
      trail.userData.telemetryTrail = true
      markerGroup.add(trail)

      const latestPoint = trailPoints[trailPoints.length - 1]
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 16),
        new THREE.MeshBasicMaterial({ color: '#f1e2c6', transparent: true, opacity: 0.9 }),
      )
      disableMapPicking(beacon)
      beacon.position.copy(latestPoint)
      markerGroup.add(beacon)
    }

    flightRoutes.forEach((flightRoute, routeIndex) => {
      const routePoints = flightRoute.points.map((point) => {
        const position = point.contact
          ? displayContactPosition(point.contact, currentPosition, mapProjection, systemBodies, bodyScaleMode)
          : contactPosition(point.coordinate, currentPosition, mapProjection.scale)
        return position.clone().setY(position.y + 0.18 + routeIndex * 0.08)
      })
      if (routePoints.length < 2) return
      const routeGeometry = new THREE.BufferGeometry().setFromPoints(routePoints)
      const routeMaterial = new THREE.LineDashedMaterial({
        color: flightRoute.color,
        dashSize: flightRoute.status === 'Prospect' ? 2.2 : 4,
        gapSize: flightRoute.status === 'Prospect' ? 1.7 : 1.4,
        transparent: true,
        opacity: flightRoute.status === 'Prospect' ? 0.42 : 0.72,
      })
      const route = new THREE.Line(routeGeometry, routeMaterial)
      route.computeLineDistances()
      route.renderOrder = 4
      disableMapPicking(route)
      markerGroup.add(route)
    })

    if (projectedContact && projectedContact.id !== currentShipContact.id) {
      const projectedPosition = displayContactPosition(projectedContact, currentPosition, mapProjection, systemBodies, bodyScaleMode)
      const routeGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.16, 0), projectedPosition.clone().setY(projectedPosition.y + 0.16)])
      const routeMaterial = new THREE.LineDashedMaterial({ color: '#f6b94d', dashSize: 3.8, gapSize: 1.8, transparent: true, opacity: 0.86 })
      const route = new THREE.Line(routeGeometry, routeMaterial)
      route.computeLineDistances()
      route.renderOrder = 5
      disableMapPicking(route)
      markerGroup.add(route)
    }

    if (selectedContact && selectedContact.id !== currentShipContact.id) {
      const selectedPosition = displayContactPosition(selectedContact, currentPosition, mapProjection, systemBodies, bodyScaleMode)
      const vectorGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), selectedPosition])
      const vectorMaterial = new THREE.LineBasicMaterial({ color: '#f1e2c6', transparent: true, opacity: 0.72 })
      markerGroup.add(disableMapPicking(new THREE.Line(vectorGeometry, vectorMaterial)))
    }

    if (encounterMemory.length) {
      const memoryPositions: number[] = []
      const memoryColors: number[] = []
      encounterMemory.forEach((contact) => {
        const position = contactPosition(contact, currentPosition, mapProjection.scale)
        const color = new THREE.Color(contact.color || '#76918f')
        memoryPositions.push(position.x, position.y, position.z)
        memoryColors.push(color.r, color.g, color.b)
      })
      const memoryGeometry = new THREE.BufferGeometry()
      memoryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(memoryPositions, 3))
      memoryGeometry.setAttribute('color', new THREE.Float32BufferAttribute(memoryColors, 3))
      memoryGeometry.computeBoundingSphere()
      const memoryMaterial = new THREE.PointsMaterial({
        size: 0.58,
        sizeAttenuation: true,
        vertexColors: true,
        depthWrite: false,
        opacity: 0.42,
        transparent: true,
      })
      const memoryCloud = new THREE.Points(memoryGeometry, memoryMaterial)
      memoryCloud.renderOrder = 1
      memoryCloud.userData.encounterMemory = true
      markerGroup.add(disableMapPicking(memoryCloud))
    }

    const asteroidClusters = createAsteroidMapClusters(contacts)
    const clusteredAsteroidIds = new Set(asteroidClusters.flatMap((cluster) => cluster.contacts.map((contact) => contact.id)))

    asteroidClusters.forEach((cluster) => {
      const selectedClusterContact = cluster.contacts.find((contact) => contact.id === selectedContactId)
      const isSelected = Boolean(selectedClusterContact)
      const contactColor = '#8d9498'
      const markerPosition = contactPosition(cluster.center, currentPosition, mapProjection.scale)
      const marker = new THREE.Mesh(
        new THREE.DodecahedronGeometry(isSelected ? 0.52 : 0.42, 0),
        new THREE.MeshStandardMaterial({
          color: contactColor,
          emissive: contactColor,
          emissiveIntensity: isSelected ? 0.96 : 0.42,
          roughness: 0.42,
        }),
      )
      marker.position.copy(markerPosition)
      marker.userData.contactId = selectedClusterContact?.id ?? cluster.contacts[0].id
      markerGroup.add(marker)

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 1.25 : 1.05, 16, 16),
        new THREE.MeshBasicMaterial({ color: contactColor, depthWrite: false, opacity: isSelected ? 0.14 : 0.08, transparent: true }),
      )
      disableMapPicking(halo)
      halo.position.copy(markerPosition)
      markerGroup.add(halo)

      const label = createBodyLabel(cluster.label, contactColor, isSelected)
      setMapLabelScale(label, isSelected ? 6.2 : 3.2, isSelected ? 1.52 : 0.78, 0.24, 0.92)
      label.position.copy(markerPosition)
      label.position.y += isSelected ? 3.25 : 2.45
      disableMapPicking(label)
      markerGroup.add(label)

      const hitArea = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 1.8 : 1.45, 14, 14),
        new THREE.MeshBasicMaterial({ color: contactColor, depthWrite: false, opacity: 0, transparent: true }),
      )
      hitArea.position.copy(markerPosition)
      hitArea.userData.contactId = selectedClusterContact?.id ?? cluster.contacts[0].id
      markerGroup.add(hitArea)
    })

    contacts.forEach((contact) => {
      if (clusteredAsteroidIds.has(contact.id)) return
      const isSelected = contact.id === selectedContactId
      const isHostile = isHostileContact(contact)
      const contactColor = contact.kind === 'gps' ? '#3dff93' : displayColorForContact(contact)
      const bodyIsReference = mapProjection.liveFocus
        && contact.kind === 'body'
        && distanceMeters(currentPosition, contact) > mapProjection.bodyReferenceRangeMeters
      const radius = bodyVisualRadius(contact, mapProjection.scale, bodyIsReference, bodyScaleMode)
      const markerPosition = displayContactPosition(contact, currentPosition, mapProjection, systemBodies, bodyScaleMode)
      const defenseEnvelope = contactDefenseEnvelope(contact)
      if (defenseEnvelope) {
        addDefenseEnvelope(markerGroup, markerPosition, mapProjection.scale, isSelected, defenseEnvelope.color, defenseEnvelope.ranges)
      }

      if (contact.kind === 'gps') {
        const marker = createGpsCrosshairMarker(contactColor, isSelected)
        marker.position.copy(markerPosition)
        marker.userData.contactId = contact.id
        markerGroup.add(marker)
      } else {
        const geometry = contact.kind === 'body'
          ? new THREE.SphereGeometry(isSelected ? radius * 1.12 : radius, 36, 36)
          : createContactGeometry(contact, isSelected)
        const material = contact.kind === 'body'
          ? new THREE.MeshStandardMaterial({
            color: '#ffffff',
            emissive: contactColor,
            emissiveIntensity: isSelected ? 0.18 : 0.06,
            map: createPlanetTexture(contact),
            metalness: 0,
            roughness: 0.82,
          })
          : new THREE.MeshStandardMaterial({
            color: contactColor,
            emissive: contactColor,
            emissiveIntensity: isHostile ? (isSelected ? 1.35 : 0.94) : isSelected ? 0.82 : 0.35,
            roughness: 0.35,
          })
        const marker = new THREE.Mesh(geometry, material)
        marker.position.copy(markerPosition)
        marker.userData.contactId = contact.id
        if (contact.kind === 'body') marker.userData.spinRate = isMoonBody(contact) ? 0.0012 : 0.0007
        markerGroup.add(marker)

        if (contact.kind === 'body') {
          const glow = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.34, 36, 36),
            new THREE.MeshBasicMaterial({
              color: contactColor,
              depthWrite: false,
              opacity: isSelected ? 0.18 : 0.1,
              transparent: true,
            }),
          )
          disableMapPicking(glow)
          glow.position.copy(markerPosition)
          markerGroup.add(glow)

          const label = createBodyLabel(contact.name, contactColor, isSelected)
          if (bodyIsReference) setMapLabelScale(label, isMoonBody(contact) ? 5.8 : 7.2, isMoonBody(contact) ? 1.44 : 1.78, 0.3, 1.06)
          else if (isMoonBody(contact)) setMapLabelScale(label, isSelected ? 9.4 : 7.8, isSelected ? 2.32 : 1.92, 0.3, 1.08)
          else setMapLabelScale(label, isSelected ? 12.2 : 10.2, isSelected ? 3.0 : 2.5, 0.3, 1.1)
          label.position.copy(markerPosition)
          label.position.y += radius + (isMoonBody(contact) ? 2.35 : isSelected ? 4.1 : 3.4)
          disableMapPicking(label)
          markerGroup.add(label)
        }
      }

      if (contact.kind !== 'body' && shouldShowContactLabel(contact, isSelected)) {
        const label = createBodyLabel(mapLabelForContact(contact), contactColor, isSelected)
        if (contact.kind === 'asteroid') {
          setMapLabelScale(label, isSelected ? 5.8 : 2.75, isSelected ? 1.42 : 0.68, 0.24, 0.9)
        } else if (contact.kind === 'gps') {
          setMapLabelScale(label, isSelected ? 7.2 : 5.4, isSelected ? 1.78 : 1.34, 0.22, 0.92)
        } else {
          setMapLabelScale(label, isSelected ? 8.8 : 6.6, isSelected ? 2.18 : 1.64, 0.28, 1.04)
        }
        label.position.copy(markerPosition)
        label.position.y += contact.kind === 'gps'
          ? (isSelected ? 4.5 : 3.7)
          : nonBodyVisualRadius(contact, isSelected) + (isSelected ? 2.6 : 2.1)
        disableMapPicking(label)
        markerGroup.add(label)
      }

      const hitRadius = contact.kind === 'body'
        ? Math.max(2.6, radius * 1.45)
        : contact.kind === 'custom'
          ? isSelected ? 2.1 : 1.7
          : contact.kind === 'asteroid'
            ? isSelected ? 1.4 : 1.1
            : isSelected ? 2.4 : 1.8
      const hitArea = new THREE.Mesh(
        new THREE.SphereGeometry(hitRadius, 16, 16),
        new THREE.MeshBasicMaterial({ color: contactColor, depthWrite: false, opacity: 0, transparent: true }),
      )
      hitArea.position.copy(markerPosition)
      hitArea.userData.contactId = contact.id
      markerGroup.add(hitArea)
    })
  }, [bodyScaleMode, cameraMode, contacts, currentPosition, currentShipContact, encounterMemory, flightRoutes, focusContactId, focusRequestId, projectedContact, selectedContactId, systemBodies, telemetryTrail])

  return (
    <div
      className="shipOsMapCanvas"
      ref={mountRef}
      role="application"
      tabIndex={0}
      aria-label={cameraMode === 'forward'
        ? `Intrepid forward sensor view tracking ${projectedContact?.name ?? 'the current flight vector'}.`
        : 'Interactive 3D star system map. Arrow keys pan and plus or minus zoom.'}
      onKeyDown={(event) => {
        const camera = cameraRef.current
        const controls = controlsRef.current
        if (!camera || !controls || cameraMode === 'forward') return
        const distance = camera.position.distanceTo(controls.target)
        const panStep = Math.max(0.8, distance * 0.045)
        const zoomFactor = event.key === '+' || event.key === '=' ? 0.86 : event.key === '-' || event.key === '_' ? 1.16 : 1
        const panOffset = new THREE.Vector3()
        if (event.key === 'ArrowLeft') panOffset.x = -panStep
        else if (event.key === 'ArrowRight') panOffset.x = panStep
        else if (event.key === 'ArrowUp') panOffset.z = -panStep
        else if (event.key === 'ArrowDown') panOffset.z = panStep
        else if (zoomFactor !== 1) {
          const offset = camera.position.clone().sub(controls.target).multiplyScalar(zoomFactor)
          camera.position.copy(controls.target).add(offset)
        } else return
        if (panOffset.lengthSq() > 0) {
          camera.position.add(panOffset)
          controls.target.add(panOffset)
        }
        event.preventDefault()
        controls.update()
      }}
    >
      {cameraMode === 'forward' && (
        <div className="shipOsForwardHud" aria-hidden="true">
          <div className="shipOsForwardHudStatus">
            <strong>INTREPID // FORWARD</strong>
            <span>TRACK {projectedContact?.name ?? 'VELOCITY VECTOR'}</span>
          </div>
          <i className="shipOsForwardReticle" />
        </div>
      )}
    </div>
  )
}

function createWedgeGeometry() {
  const vertices = new Float32Array([
    -0.46, -0.46, -0.46,
    0.46, -0.46, -0.46,
    0.46, -0.46, 0.46,
    -0.46, -0.46, 0.46,
    -0.46, 0.46, -0.46,
    0.46, 0.46, -0.46,
  ])
  const indices = [
    0, 1, 2, 0, 2, 3,
    0, 4, 5, 0, 5, 1,
    1, 5, 2,
    0, 3, 4,
    3, 2, 5, 3, 5, 4,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createCornerGeometry() {
  const vertices = new Float32Array([
    -0.46, -0.46, -0.46,
    0.46, -0.46, -0.46,
    -0.46, -0.46, 0.46,
    -0.46, 0.46, -0.46,
  ])
  const indices = [
    0, 1, 2,
    0, 3, 1,
    0, 2, 3,
    1, 3, 2,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createBlueprintBlockGeometry(shape: BlueprintBlockShape) {
  if (shape === 'slope') return createWedgeGeometry()
  if (shape === 'corner') return createCornerGeometry()
  if (shape === 'thin') return new THREE.BoxGeometry(0.92, 0.18, 0.92)
  if (shape === 'truss') return new THREE.BoxGeometry(0.62, 0.62, 0.62)
  return new THREE.BoxGeometry(0.9, 0.9, 0.9)
}

function eulerForBlockOrientation(forward = 'Forward', up = 'Up') {
  const euler = new THREE.Euler(0, 0, 0)
  if (forward === 'Backward') euler.y = Math.PI
  if (forward === 'Left') euler.y = Math.PI / 2
  if (forward === 'Right') euler.y = -Math.PI / 2
  if (forward === 'Up') euler.x = -Math.PI / 2
  if (forward === 'Down') euler.x = Math.PI / 2

  if (up === 'Left') euler.z += Math.PI / 2
  if (up === 'Right') euler.z -= Math.PI / 2
  if (up === 'Backward') euler.z += Math.PI
  return euler
}

function BlueprintModelViewer({ snapshot, preset }: { snapshot: BlueprintSnapshot | null; preset: BlueprintViewPreset }) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    const blocks = snapshot?.modelBlocks ?? []
    if (!mount || blocks.length === 0) return

    const bounds = preset === 'actual'
      ? normalizeBounds(boundsForBlocks(blocks, true))
      : snapshot?.bounds ?? normalizeBounds(boundsForBlocks(blocks))
    const width = Math.max(1, bounds.maxX - bounds.minX + 1)
    const height = Math.max(1, bounds.maxY - bounds.minY + 1)
    const depth = Math.max(1, bounds.maxZ - bounds.minZ + 1)
    const maxDimension = Math.max(width, height, depth)
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#020507')

    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 1200)
    camera.position.set(maxDimension * 0.92, maxDimension * 0.55, maxDimension * 1.35)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.minDistance = Math.max(8, maxDimension * 0.35)
    controls.maxDistance = Math.max(80, maxDimension * 6)
    controls.target.set(0, 0, 0)

    scene.add(new THREE.HemisphereLight('#dffdf5', '#12211f', 1.25))
    scene.add(new THREE.AmbientLight('#cde9e3', 0.78))
    const key = new THREE.DirectionalLight('#f1e2c6', 2.8)
    key.position.set(24, 34, 28)
    scene.add(key)
    const rim = new THREE.DirectionalLight('#7de8d2', 1.85)
    rim.position.set(-28, 18, -24)
    scene.add(rim)

    const grid = new THREE.GridHelper(Math.max(32, maxDimension + 10), Math.max(12, Math.ceil(maxDimension / 2)), '#31534f', '#182623')
    grid.position.y = -height / 2 - 0.58
    scene.add(grid)

    const groupedBlocks = new Map<string, BlueprintModelBlock[]>()
    blocks.forEach((block) => {
      const shape = preset === 'shape' ? block.shape ?? 'cube' : 'cube'
      const key = `${shape}|${block.category}`
      groupedBlocks.set(key, [...(groupedBlocks.get(key) ?? []), block])
    })

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    groupedBlocks.forEach((items, key) => {
      const [shape, category] = key.split('|') as [BlueprintBlockShape, BlueprintBlockCategory]
      const geometry = createBlueprintBlockGeometry(shape)
      const material = new THREE.MeshStandardMaterial({
        color: blueprintCategoryColor(category),
        emissive: blueprintCategoryColor(category),
        emissiveIntensity: shape === 'thin' || shape === 'truss' ? 0.14 : 0.07,
        roughness: 0.68,
        metalness: 0.08,
      })
      const mesh = new THREE.InstancedMesh(geometry, material, items.length)
      items.forEach((block, index) => {
        const footprint = blueprintFootprintForBlock(block)
        position.set(block.x - center.x, block.y - center.y, block.z - center.z)
        quaternion.setFromEuler(eulerForBlockOrientation(block.forward, block.up))
        if (preset === 'actual') {
          scale.set(footprint.sizeX, footprint.sizeY, footprint.sizeZ)
        } else {
          scale.set(1, 1, 1)
        }
        matrix.compose(position, quaternion, scale)
        mesh.setMatrixAt(index, matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      scene.add(mesh)
    })

    const outline = new THREE.Box3(
      new THREE.Vector3(bounds.minX - center.x - 0.5, bounds.minY - center.y - 0.5, bounds.minZ - center.z - 0.5),
      new THREE.Vector3(bounds.maxX - center.x + 0.5, bounds.maxY - center.y + 0.5, bounds.maxZ - center.z + 0.5),
    )
    const helper = new THREE.Box3Helper(outline, '#f1e2c6')
    scene.add(helper)

    const resize = () => {
      const widthPx = Math.max(320, mount.clientWidth)
      const heightPx = Math.max(360, mount.clientHeight)
      renderer.setSize(widthPx, heightPx)
      camera.aspect = widthPx / heightPx
      camera.updateProjectionMatrix()
    }
    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    let animationFrame = 0
    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.traverse((child) => {
        const object = child as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] }
        object.geometry?.dispose()
        disposeMaterial(object.material)
      })
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      scene.clear()
    }
  }, [preset, snapshot])

  return <div className="shipOsBlueprintViewerCanvas" ref={mountRef} aria-label={`${blueprintViewPresetOptions.find((option) => option.id === preset)?.label ?? 'Blueprint'} rotatable block model`}>{!snapshot?.modelBlocks?.length && <span>No parsed block model yet</span>}</div>
}

export function ShipOSPage({
  experience = 'console',
  onBack,
  accessToken,
  isSignedIn,
  canUseRelay,
  accountName,
  accountMode,
  onSignIn,
  onSignOut,
}: ShipOSPageProps) {
  const isNavigationExperience = experience === 'navigation'
  const [activeTab, setActiveTab] = useState<ShipTabId>(isNavigationExperience ? 'navigation' : 'captain')
  const [mapDrawerOpen, setMapDrawerOpen] = useState(isNavigationExperience)
  const [mapCameraMode, setMapCameraMode] = useState<MapCameraMode>('overhead')
  const [masterAlarm, setMasterAlarm] = useState<MasterAlarmState>({ level: 'normal', reason: 'Systems nominal', triggeredAt: null })
  const [alarmSoundUplinkEnabled, setAlarmSoundUplinkEnabled] = usePersistentState<boolean>('shipos-alarm-sound-uplink-enabled', false)
  const [currentPosition, setCurrentPosition] = usePersistentState<ShipCoordinate>('shipos-current-position', initialPosition)
  const [customContacts, setCustomContacts] = usePersistentState<ShipContact[]>('shipos-custom-contacts', [])
  const [crewMembers, setCrewMembers] = usePersistentState<CrewMember[]>('shipos-crew-roster', initialCrew)
  const [cargoItems, setCargoItems] = usePersistentState<CargoItem[]>('shipos-cargo-items', initialCargo)
  const [jobRecords, setJobRecords] = usePersistentState<JobRecord[]>('shipos-job-records', initialJobs)
  const [passengerFiles, setPassengerFiles] = usePersistentState<PassengerFile[]>('shipos-passenger-files', initialPassengerFiles)
  const [bankEntries, setBankEntries] = usePersistentState<BankEntry[]>('shipos-bank-entries', createInitialBankEntries())
  const [waves, setWaves] = usePersistentState<Wave[]>('shipos-waves', createInitialWaves())
  const [autoWaveEnabled, setAutoWaveEnabled] = usePersistentState<boolean>('shipos-auto-wave-enabled', true)
  const [shipLogs, setShipLogs] = usePersistentState<ShipLog[]>('shipos-logs', createInitialLogs())
  const [contactNotes, setContactNotes] = usePersistentState<Record<string, string>>('shipos-contact-notes', {})
  const [contactImages, setContactImages] = usePersistentState<ContactImageAttachment[]>('shipos-contact-images', [])
  const [generatedPortraits, setGeneratedPortraits] = usePersistentState<GeneratedPortrait[]>('shipos-generated-portraits', [])
  const [metagameRecords, setMetagameRecords] = usePersistentState<MetagameRecord[]>('shipos-metagame-records', initialMetagameRecords)
  const [savedLocationRecords, setSavedLocationRecords] = usePersistentState<LocationRecord[]>('shipos-location-records', initialLocationRecords)
  const [directoryEntities, setDirectoryEntities] = usePersistentState<DirectoryEntity[]>('shipos-directory-entities', initialDirectoryEntities)
  const [shipConfigurations, setShipConfigurations] = usePersistentState<ShipConfigurationRecord[]>('shipos-ship-configurations', initialShipConfigurations)
  const [squawkRecords, setSquawkRecords] = usePersistentState<SquawkRecord[]>('shipos-squawk-list', initialSquawks)
  const [commitmentRecords, setCommitmentRecords] = usePersistentState<CommitmentRecord[]>('shipos-commitments', initialCommitments)
  const [chronicleEntries, setChronicleEntries] = usePersistentState<ChronicleEntry[]>('shipos-chronicle', initialChronicle)
  const [medicalFacilities, setMedicalFacilities] = usePersistentState<MedicalFacilityRecord[]>('shipos-medical-facilities', initialMedicalFacilities)
  const [securityIncidents, setSecurityIncidents] = usePersistentState<SecurityIncidentRecord[]>('shipos-security-incidents', initialSecurityIncidents)
  const [storesRecords, setStoresRecords] = usePersistentState<StoresRecord[]>('shipos-stores-records', initialStoresRecords)
  const [lastTelemetryPacket, setLastTelemetryPacket] = usePersistentState<TelemetryPacket | null>('shipos-last-telemetry-packet', null)
  const [liveTelemetryContacts, setLiveTelemetryContacts] = useState<ShipContact[]>(() => lastTelemetryPacket
    ? contactsFromTelemetryPacket(lastTelemetryPacket).filter((contact) => !isKnownPlanetaryChartContact(contact))
    : [])
  const [encounterMemory, setEncounterMemory] = usePersistentState<EncounterMemoryContact[]>('shipos-contact-memory', [])
  const [encounterMemoryVisible, setEncounterMemoryVisible] = usePersistentState<boolean>('shipos-contact-memory-visible', true)
  const [telemetryHistory, setTelemetryHistory] = usePersistentState<TelemetrySample[]>('shipos-telemetry-history', [])
  const [navigationPlan, setNavigationPlan] = usePersistentState<NavigationPlanDraft>('shipos-navigation-plan', createDefaultNavigationPlan())
  const [planetaryChartOverrides, setPlanetaryChartOverrides] = usePersistentState<PlanetaryChartOverrides>('shipos-planetary-chart-overrides', {})
  const [bridgeConfig, setBridgeConfig] = usePersistentState<BridgeConfig>('shipos-bridge-config', createDefaultBridgeConfig())
  const [blueprintSnapshots, setBlueprintSnapshots] = usePersistentState<BlueprintSnapshot[]>('shipos-blueprint-snapshots', [])
  const [blueprintViewPreset, setBlueprintViewPreset] = usePersistentState<BlueprintViewPreset>('shipos-blueprint-view-preset', 'shape')
  const [contactFilters, setContactFilters] = usePersistentState<ContactFilterState>('shipos-contact-filters', createDefaultContactFilters())
  const [contactSearchText, setContactSearchText] = usePersistentState<string>('shipos-contact-search', '')
  const [contactSortState, setContactSortState] = usePersistentState<ContactSortState>('shipos-contact-sort', defaultContactSortState)
  const [contactDesignations, setContactDesignations] = usePersistentState<Record<string, ContactDispositionOverride>>('shipos-contact-designations', {})
  const [contactFactionAssignments, setContactFactionAssignments] = usePersistentState<Record<string, string>>('shipos-contact-factions', {})
  const [bodyScaleMode, setBodyScaleMode] = usePersistentState<BodyScaleMode>('shipos-body-scale-mode', 'true-scale')
  const [displayPreferences, setDisplayPreferences] = usePersistentState<ShipOsDisplayPreferences>('shipos-display-preferences', defaultShipOsDisplayPreferences)
  const [shipOsAiModels, setShipOsAiModels] = useState<ShipOsAiModelOption[]>([
    { providerName: 'OpenRouter', modelName: 'openai/gpt-4o-mini', displayName: 'OpenRouter | GPT-4o mini', isDefault: true },
  ])
  const [shipOsAiModelKey, setShipOsAiModelKey] = usePersistentState<string>('shipos-ai-model', '')
  const [shipOsAiPrompt, setShipOsAiPrompt] = useState('Prepare a concise captain\'s brief. Prioritize immediate hazards, navigation decisions, open commitments, and communications requiring action.')
  const [shipOsAiReply, setShipOsAiReply] = useState('')
  const [shipOsAiError, setShipOsAiError] = useState('')
  const [shipOsAiBusy, setShipOsAiBusy] = useState(false)
  const [stateSyncStatus, setStateSyncStatus] = useState(accessToken ? 'Connecting to campaign database' : 'Local storage only')
  const [relayPairingKey, setRelayPairingKey] = useState('')
  const [relayPairingBusy, setRelayPairingBusy] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [mapFocusContactId, setMapFocusContactId] = useState(currentShipContactId)
  const [mapFocusRequest, setMapFocusRequest] = useState(0)
  const [waypointDraft, setWaypointDraft] = useState<DraftWaypoint>(createDefaultWaypointDraft())
  const [gpsImportDraft, setGpsImportDraft] = useState('')
  const [modalDraft, setModalDraft] = useState<ContactModalDraft>({ name: '', className: '', factionName: '', notes: '' })
  const [waveDraft, setWaveDraft] = useState<WaveDraft>(createDefaultWaveDraft())
  const [echoMailFolder, setEchoMailFolder] = usePersistentState<EchoMailFolder>('shipos-echomail-folder', 'inbox')
  const [echoMailSearch, setEchoMailSearch] = usePersistentState<string>('shipos-echomail-search', '')
  const [echoMailPage, setEchoMailPage] = useState(0)
  const [selectedEchoThreadKey, setSelectedEchoThreadKey] = useState('')
  const [crewDraft, setCrewDraft] = useState<CrewFormDraft>(createDefaultCrewDraft())
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null)
  const [crewEditDraft, setCrewEditDraft] = useState<CrewFormDraft>(createDefaultCrewDraft())
  const [cargoDraft, setCargoDraft] = useState({ name: '', category: 'Resource', quantity: '', mass: '', bay: '' })
  const [selectedJobId, setSelectedJobId] = useState('job-ares-europa-pelagos-passage')
  const [jobDraft, setJobDraft] = useState<JobDraft>(createDefaultJobDraft())
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [jobEditDraft, setJobEditDraft] = useState<JobDraft>(createDefaultJobDraft())
  const [passengerDraft, setPassengerDraft] = useState<PassengerDraft>(createDefaultPassengerDraft())
  const [editingPassengerId, setEditingPassengerId] = useState<string | null>(null)
  const [passengerEditDraft, setPassengerEditDraft] = useState<PassengerDraft>(createDefaultPassengerDraft())
  const [personnelFileSelection, setPersonnelFileSelection] = useState<PersonnelFileSelection | null>(null)
  const [bankMonth, setBankMonth] = useState(currentMonthKey())
  const [bankDraft, setBankDraft] = useState<BankDraft>({
    date: currentIsoDate(),
    kind: 'expense',
    vendor: '',
    category: 'Payroll',
    amount: '',
    recurring: false,
    notes: '',
  })
  const [portraitMakerDraft, setPortraitMakerDraft] = useState<PortraitMakerDraft>(createDefaultPortraitDraft())
  const [editingGeneratedPortraitId, setEditingGeneratedPortraitId] = useState<string | null>(null)
  const [metagameDraft, setMetagameDraft] = useState<MetagameDraft>(createDefaultMetagameDraft())
  const [editingMetagameId, setEditingMetagameId] = useState<string | null>(null)
  const [metagameKindFilter, setMetagameKindFilter] = useState<'All' | MetagameRecord['kind']>('All')
  const [telemetryDraft, setTelemetryDraft] = useState('')
  const [planetaryCalibrationDraft, setPlanetaryCalibrationDraft] = useState<PlanetaryCalibrationDraft>(createDefaultPlanetaryCalibrationDraft())
  const [planetaryCalibrationError, setPlanetaryCalibrationError] = useState('')
  const [telemetryError, setTelemetryError] = useState('')
  const [bridgeError, setBridgeError] = useState('')
  const [blueprintError, setBlueprintError] = useState('')
  const [imageryError, setImageryError] = useState('')
  const telemetryHistoryRef = useRef<TelemetrySample[]>(telemetryHistory)
  const modalDraftContactIdRef = useRef<string | null>(null)
  const remoteStateRevisionRef = useRef<number | null>(null)
  const remoteStateSaveTimerRef = useRef<number | null>(null)
  const masterAlarmCautionArmedRef = useRef(true)
  const masterAlarmCriticalActiveRef = useRef(false)
  const masterAlarmCriticalAcknowledgedRef = useRef(false)
  const contactModalRef = useRef<HTMLElement | null>(null)
  const contactModalReturnFocusRef = useRef<HTMLElement | null>(null)
  const personnelFileModalRef = useRef<HTMLElement | null>(null)
  const personnelFileReturnFocusRef = useRef<HTMLElement | null>(null)
  const pollTelemetryBridgeRef = useRef<(options?: { silent?: boolean }) => Promise<unknown>>(async () => undefined)

  const displayFontSize = Math.min(18, Math.max(10, Number(displayPreferences.fontSize) || defaultShipOsDisplayPreferences.fontSize))
  const displayFontFace = shipOsFontFaceOptions.find((option) => option.id === displayPreferences.fontFace) ?? shipOsFontFaceOptions[0]
  const shipOsDisplayStyle = {
    '--shipos-ui-font-size': `${displayFontSize}px`,
    '--shipos-ui-font-body': `${Math.max(9, displayFontSize - 1)}px`,
    '--shipos-ui-font-small': `${Math.max(8, displayFontSize - 2)}px`,
    '--shipos-ui-font-heading': `${displayFontSize + 5}px`,
    '--shipos-ui-font-family': displayFontFace.family,
  } as CSSProperties

  const calibratedStarSystemBodies = useMemo(
    () => applyPlanetaryChartOverrides(starSystemBodies, planetaryChartOverrides),
    [planetaryChartOverrides],
  )
  const livePlanetRegistry = useMemo(() => {
    if (!lastTelemetryPacket) return []
    return contactsFromTelemetryPacket(lastTelemetryPacket)
      .filter((contact) => contact.kind === 'body' && contact.contactSource === 'planet-registry')
      .sort((left, right) => {
        const leftKnown = Boolean(bodyIdFromContactForCalibration(left))
        const rightKnown = Boolean(bodyIdFromContactForCalibration(right))
        return Number(rightKnown) - Number(leftKnown) || left.name.localeCompare(right.name)
      })
  }, [lastTelemetryPacket])
  const unknownLivePlanetCount = livePlanetRegistry.filter((contact) => !bodyIdFromContactForCalibration(contact)).length
  const savedTelemetryContactOverrides = useMemo(
    () => new Map(customContacts.filter(isTelemetryManagedContact).map((contact) => [contact.id, contact] as const)),
    [customContacts],
  )
  const allContacts = useMemo(() => {
    const contacts = [
      ...calibratedStarSystemBodies,
      ...relayContacts,
      ...customContacts.filter((contact) => !isTelemetryManagedContact(contact) && !isHiddenTelemetryContact(contact) && !isKnownPlanetaryChartContact(contact)),
      ...liveTelemetryContacts
        .filter((contact) => !isHiddenTelemetryContact(contact) && !isKnownPlanetaryChartContact(contact))
        .map((contact) => applySavedTelemetryContactOverride(contact, savedTelemetryContactOverrides.get(contact.id))),
    ]
    return contacts
      .map((contact) => applyContactDispositionOverride(contact, contactDesignations[contact.id]))
      .map((contact) => applyContactFactionAssignment(contact, contactFactionAssignments[contact.id]))
  }, [calibratedStarSystemBodies, contactDesignations, contactFactionAssignments, customContacts, liveTelemetryContacts, savedTelemetryContactOverrides])
  const contactFactionOptions = useMemo(
    () => createContactFactionOptions(allContacts, metagameRecords, directoryEntities),
    [allContacts, directoryEntities, metagameRecords],
  )
  const normalizedContactFilters = useMemo(
    () => normalizeContactFilters(contactFilters, contactFactionOptions.map((option) => option.id)),
    [contactFactionOptions, contactFilters],
  )
  const normalizedContactSort = useMemo(() => normalizeContactSortState(contactSortState), [contactSortState])
  const visibleContacts = useMemo(
    () => allContacts.filter((contact) => contactVisibleByFilters(contact, normalizedContactFilters)
      && (contactAlwaysVisible(contact) || contactMatchesSearch(contact, contactSearchText))),
    [allContacts, contactSearchText, normalizedContactFilters],
  )
  const archivedEncounterMemory = useMemo(() => {
    const liveKeys = new Set(liveTelemetryContacts.map(contactMemoryKey))
    return encounterMemory.filter((contact) => !liveKeys.has(contact.key))
  }, [encounterMemory, liveTelemetryContacts])
  const visibleEncounterMemory = useMemo(() => {
    const search = normalizeContactSearchText(contactSearchText)
    return archivedEncounterMemory.filter((contact) => {
      if (memoryContactAlwaysVisible(contact)) return true
      if (!encounterMemoryVisible) return false
      if (!memoryContactVisibleByFilters(contact, normalizedContactFilters)) return false
      return !search || normalizeContactSearchText(`${contact.name} ${contact.kind}`).includes(search)
    })
  }, [archivedEncounterMemory, contactSearchText, encounterMemoryVisible, normalizedContactFilters])
  const locationRecords = useMemo(() => {
    const calibratedSaved = savedLocationRecords.map((location) => applyBodyCalibrationToLocation(location, calibratedStarSystemBodies))
    const savedIds = new Set(calibratedSaved.map((location) => location.id))
    const derived = allContacts
      .map((contact) => locationRecordFromContact(contact, calibratedStarSystemBodies))
      .filter((location) => !savedIds.has(location.id))
    return [...calibratedSaved, ...derived].sort((left, right) => left.name.localeCompare(right.name))
  }, [allContacts, calibratedStarSystemBodies, savedLocationRecords])
  const currentShipContact = useMemo<ShipContact>(() => ({
    id: currentShipContactId,
    name: lastTelemetryPacket?.ship || shipName,
    className: 'Current ship position',
    kind: 'ship',
    x: currentPosition.x,
    y: currentPosition.y,
    z: currentPosition.z,
    status: lastTelemetryPacket?.stamp ? `Telemetry ${lastTelemetryPacket.stamp}` : 'Manual current position',
    color: '#7de8d2',
    notes: lastTelemetryPacket
      ? `Last packet from ${lastTelemetryPacket.source || 'telemetry'} at ${lastTelemetryPacket.stamp || 'unknown time'}. Speed ${formatMetersPerSecond(lastTelemetryPacket.speed)}.`
      : 'Current map origin. Update this manually in Navigation or through the telemetry uplink.',
    faction: 'DSV Intrepid',
    velocityX: lastTelemetryPacket?.velocityX,
    velocityY: lastTelemetryPacket?.velocityY,
    velocityZ: lastTelemetryPacket?.velocityZ,
    speed: lastTelemetryPacket?.speed,
  }), [currentPosition, lastTelemetryPacket])
  const normalizedCrewMembers = useMemo(() => crewMembers.map(normalizeCrewMember), [crewMembers])
  const sortedJobRecords = useMemo(() => [...jobRecords].sort((left, right) => {
    if (left.id === holdingJobId) return 1
    if (right.id === holdingJobId) return -1
    return jobStatusRank(left.status) - jobStatusRank(right.status)
      || left.due.localeCompare(right.due)
      || left.title.localeCompare(right.title)
  }), [jobRecords])
  const selectedJob = useMemo(() => jobRecords.find((job) => job.id === selectedJobId) ?? jobRecords.find((job) => job.id === holdingJobId) ?? jobRecords[0], [jobRecords, selectedJobId])
  const editingJob = useMemo(() => jobRecords.find((job) => job.id === editingJobId) ?? null, [editingJobId, jobRecords])
  const openPersonnelCrewMember = personnelFileSelection?.kind === 'crew'
    ? normalizedCrewMembers.find((member) => member.id === personnelFileSelection.id) ?? null
    : null
  const openPersonnelPassenger = personnelFileSelection?.kind === 'passenger'
    ? passengerFiles.find((file) => file.id === personnelFileSelection.id) ?? null
    : null
  const selectedContact = useMemo(() => selectedContactId === currentShipContactId
    ? currentShipContact
    : allContacts.find((contact) => contact.id === selectedContactId) ?? null, [allContacts, currentShipContact, selectedContactId])
  const selectedLocationRecord = useMemo(() => {
    if (!selectedContact) return null
    return locationRecords.find((location) => location.contactId === selectedContact.id || location.id === `loc-${selectedContact.id}`) ?? null
  }, [locationRecords, selectedContact])
  const mapFocusContact = useMemo(() => mapFocusContactId === currentShipContactId
    ? currentShipContact
    : allContacts.find((contact) => contact.id === mapFocusContactId) ?? currentShipContact, [allContacts, currentShipContact, mapFocusContactId])
  const mapFocusContactIsVisible = mapFocusContact.id === currentShipContactId || visibleContacts.some((contact) => contact.id === mapFocusContact.id)
  const selectedSavedContact = selectedContact ? customContacts.find((contact) => contact.id === selectedContact.id) : undefined
  const selectedIsCustom = Boolean(selectedSavedContact && !isTelemetryManagedContact(selectedSavedContact))
  const selectedIsLiveTelemetry = Boolean(selectedContact && liveTelemetryContacts.some((contact) => contact.id === selectedContact.id))
  const selectedCanEditRecord = selectedIsCustom || selectedIsLiveTelemetry
  const selectedContactTitle = selectedContact ? contactFileTitle(selectedContact) : ''
  const selectedContactOriginalName = selectedContact ? originalNameForContact(selectedContact) : ''
  const selectedDefenseEnvelope = selectedContact ? contactDefenseEnvelope(selectedContact) : null
  const selectedCanBeDesignated = Boolean(selectedContact && selectedContact.id !== currentShipContactId && selectedContact.kind !== 'body')
  const selectedCanAssignFaction = Boolean(selectedContact && selectedContact.id !== currentShipContactId)
  const selectedBodyCalibration = selectedContact ? planetaryChartOverrides[selectedContact.id] : undefined
  const selectedManualDesignation = selectedContact ? contactDesignations[selectedContact.id] : undefined
  const selectedDesignation = selectedManualDesignation ?? 'auto'
  const selectedInferredIff = selectedContact ? contactIffFilterId(selectedContact) : 'unknown'
  const selectedManualFaction = selectedContact ? normalizeFactionName(contactFactionAssignments[selectedContact.id]) : ''
  const selectedFactionName = selectedContact ? contactFactionName(selectedContact) : ''
  const selectedContactImages = useMemo(() => selectedContact
    ? contactImages.filter((image) => image.contactId === selectedContact.id).sort((left, right) => right.createdAt - left.createdAt)
    : [], [contactImages, selectedContact])
  const recentContactImages = useMemo(() => [...contactImages].sort((left, right) => right.createdAt - left.createdAt), [contactImages])
  const contactImageTotalBytes = contactImages.reduce((total, image) => total + (image.byteSize || dataUrlByteSize(image.dataUrl)), 0)
  const editingGeneratedPortrait = useMemo(() => generatedPortraits.find((portrait) => portrait.id === editingGeneratedPortraitId) ?? null, [editingGeneratedPortraitId, generatedPortraits])
  const editingMetagameRecord = useMemo(() => metagameRecords.find((record) => record.id === editingMetagameId) ?? null, [editingMetagameId, metagameRecords])
  const sortedMetagameRecords = useMemo(() => [...metagameRecords].sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)), [metagameRecords])
  const filteredMetagameRecords = useMemo(
    () => metagameKindFilter === 'All' ? sortedMetagameRecords : sortedMetagameRecords.filter((record) => record.kind === metagameKindFilter),
    [metagameKindFilter, sortedMetagameRecords],
  )
  const nearbyContacts = useMemo(
    () => visibleContacts
      .map((contact) => ({ contact, distance: distanceMeters(currentPosition, contact) }))
      .sort((left, right) => compareContactRows(left, right, normalizedContactSort)),
    [currentPosition, normalizedContactSort, visibleContacts],
  )
  const cargoMass = cargoItems.reduce((total, item) => total + item.mass, 0)
  const awaitingResponses = waves.filter((wave) => wave.status === 'awaiting-response').length
  const personnelPayroll = normalizedCrewMembers.reduce((total, member) => total + (member.rateMonthly || 0), 0)
  const activePersonnel = normalizedCrewMembers.filter((member) => !['Applicant', 'Candidate'].includes(member.clearance)).length
  const recruitingPersonnel = normalizedCrewMembers.length - activePersonnel
  const activePassengerFiles = passengerFiles.filter((file) => !['Delivered', 'Declined'].includes(file.status)).length
  const flaggedPassengerFiles = passengerFiles.filter((file) => file.status === 'Flagged' || file.risk.toLowerCase().includes('high')).length
  const passengerRevenue = passengerFiles.reduce((total, file) => total + file.fare, 0)
  const bankMonthEntries = useMemo(() => bankEntries.filter((entry) => entry.date.startsWith(bankMonth)), [bankEntries, bankMonth])
  const bankMonthIncome = bankMonthEntries.filter((entry) => entry.kind === 'income').reduce((total, entry) => total + entry.amount, 0)
  const bankMonthExpenses = bankMonthEntries.filter((entry) => entry.kind === 'expense').reduce((total, entry) => total + entry.amount, 0)
  const recurringMonthlyBurn = bankEntries.filter((entry) => entry.recurring && entry.kind === 'expense').reduce((total, entry) => total + entry.amount, 0)
  const operatingBalance = bankEntries.reduce((total, entry) => total + (entry.kind === 'income' ? entry.amount : -entry.amount), 0)
  const plannedDestination = useMemo(
    () => allContacts.find((contact) => contact.id === navigationPlan.destinationId) ?? selectedContact ?? calibratedStarSystemBodies[0],
    [allContacts, calibratedStarSystemBodies, navigationPlan.destinationId, selectedContact],
  )
  const routeDistance = useMemo(() => distanceMeters(currentPosition, plannedDestination), [currentPosition, plannedDestination])
  const cruiseSpeed = Math.max(1, Number(navigationPlan.cruiseSpeed) || 95)
  const routeEta = formatDurationFromSeconds(routeDistance / cruiseSpeed)
  const telemetryAlerts = useMemo(() => buildTelemetryAlerts(lastTelemetryPacket, telemetryHistory), [lastTelemetryPacket, telemetryHistory])
  const alarmFlightDirector = useMemo(
    () => flightDirectorReading(lastTelemetryPacket, currentPosition, calibratedStarSystemBodies),
    [calibratedStarSystemBodies, currentPosition, lastTelemetryPacket],
  )
  const nearestAsteroidRange = useMemo(() => {
    const ranges = allContacts
      .filter((contact) => contact.kind === 'asteroid')
      .map((contact) => distanceMeters(currentPosition, contact))
    return ranges.length > 0 ? Math.min(...ranges) : null
  }, [allContacts, currentPosition])
  const terrainMinimumClearance = lastTelemetryPacket?.terrainScan?.length
    ? Math.min(...lastTelemetryPacket.terrainScan.map((sample) => sample.clearance))
    : null
  const terrainCriticalFloor = 45 + Math.max(0, Number(lastTelemetryPacket?.speed) || 0) * 1.2
  const terrainCritical = terrainMinimumClearance !== null && terrainMinimumClearance <= terrainCriticalFloor
  const criticalTelemetryAlert = telemetryAlerts.find((alert) => alert.level === 'Critical')
  const masterAlarmCriticalReason = terrainCritical
    ? `Terrain clearance ${formatAltitude(terrainMinimumClearance)}`
    : alarmFlightDirector.state === 'critical'
    ? alarmFlightDirector.status
    : criticalTelemetryAlert
      ? `${criticalTelemetryAlert.label}: ${criticalTelemetryAlert.detail}`
      : ''
  const masterAlarmCautionReasons = [
    alarmFlightDirector.surfaceAltitude !== null && alarmFlightDirector.surfaceAltitude < masterAlarmAltitudeCautionMeters
      ? `Radar altitude ${formatAltitude(alarmFlightDirector.surfaceAltitude)}`
      : '',
    nearestAsteroidRange !== null && nearestAsteroidRange < asteroidCautionEnvelopeMeters
      ? `Asteroid range ${formatAltitude(nearestAsteroidRange)}`
      : '',
  ].filter(Boolean)
  const masterAlarmCautionReason = masterAlarmCautionReasons.join(' / ')
  const masterAlarmCautionActive = Boolean(masterAlarmCautionReason)
  const masterAlarmCautionClear = (alarmFlightDirector.surfaceAltitude === null || alarmFlightDirector.surfaceAltitude >= 1200)
    && (nearestAsteroidRange === null || nearestAsteroidRange >= 2400)
  const telemetryDistance = useMemo(() => telemetryPathDistance(telemetryHistory), [telemetryHistory])
  const averageTelemetrySpeed = telemetryHistory.length
    ? telemetryHistory.reduce((total, sample) => total + (Number.isFinite(sample.speed) ? Number(sample.speed) : 0), 0) / telemetryHistory.length
    : 0
  const velocityTelemetryRows = useMemo(
    () => createVelocityTelemetryRows(visibleContacts, currentShipContact, currentPosition, selectedContactId),
    [currentPosition, currentShipContact, selectedContactId, visibleContacts],
  )
  const selectedVelocityTelemetry = velocityTelemetryRows.find((row) => row.selected) ?? velocityTelemetryRows[0] ?? null
  const liveVectorContacts = velocityTelemetryRows.filter((row) => row.source === 'Live vector').length
  const calibratedBodyCount = Object.keys(planetaryChartOverrides).filter((bodyId) => starSystemBodies.some((body) => body.id === bodyId)).length
  const activeJobs = useMemo(() => jobRecords.filter((job) => !['Complete', 'On Hold'].includes(job.status)), [jobRecords])
  const jobRelationshipRows = useMemo(() => sortedJobRecords.map((job) => ({
    job,
    locationIds: Array.from(new Set([...linkedLocationIdsForJob(job, locationRecords), ...locationRecords.filter((location) => location.relatedJobIds.includes(job.id)).map((location) => location.id)])),
    entityIds: Array.from(new Set([...linkedEntityIdsForJob(job, directoryEntities), ...directoryEntities.filter((entity) => entity.jobIds.includes(job.id)).map((entity) => entity.id)])),
    transactionCount: bankEntries.filter((entry) => {
      const haystack = `${entry.vendor} ${entry.category} ${entry.notes}`.toLowerCase()
      return haystack.includes(job.title.toLowerCase()) || haystack.includes(job.client.toLowerCase())
    }).length,
    communicationCount: waves.filter((wave) => {
      const haystack = `${wave.network} ${wave.from} ${wave.to} ${wave.subject} ${wave.body}`.toLowerCase()
      return haystack.includes(job.client.toLowerCase()) || haystack.includes(job.title.toLowerCase())
    }).length,
  })), [bankEntries, directoryEntities, locationRecords, sortedJobRecords, waves])
  const openSquawks = useMemo(() => squawkRecords.filter((squawk) => squawk.state !== 'CLOSED'), [squawkRecords])
  const engineeringOpenSquawkCount = squawkRecords.filter((squawk) => squawk.state === 'OPEN').length
  const engineeringWatchSquawkCount = squawkRecords.filter((squawk) => squawk.state === 'WATCH').length
  const groundingSquawkCount = squawkRecords.filter((squawk) => squawk.state === 'GROUNDING').length
  const shoppingList = useMemo(() => storesRecords.filter((item) => item.quantity < item.desiredMinimum), [storesRecords])
  const openCommitments = useMemo(() => commitmentRecords.filter((commitment) => commitment.status !== 'Fulfilled'), [commitmentRecords])
  const timelineReplayEvents = useMemo(() => [
    ...chronicleEntries.map((entry) => ({ id: entry.id, stamp: entry.stamp, label: entry.title, source: `Chronicle / ${entry.source}`, detail: entry.notes })),
    ...shipLogs.map((log) => ({ id: log.id, stamp: log.stamp, label: log.system, source: 'Ship Log', detail: log.entry })),
    ...jobRecords.map((job) => ({ id: job.id, stamp: job.createdAt, label: job.title, source: `Job / ${job.status}`, detail: job.notes })),
    ...bankEntries.map((entry) => ({ id: entry.id, stamp: new Date(entry.date).getTime() || Date.now(), label: entry.vendor, source: `Bank / ${entry.category}`, detail: `${entry.kind === 'income' ? '+' : '-'}${formatCredits(entry.amount)} ${entry.notes}` })),
  ].sort((left, right) => right.stamp - left.stamp), [bankEntries, chronicleEntries, jobRecords, shipLogs])
  const jobOpsRows = useMemo(() => sortedJobRecords.map((job) => {
    const passengers = passengerFiles.filter((file) => file.jobId === job.id)
    const fareTotal = passengers.reduce((total, file) => total + file.fare, 0)
    const destinationContact = findJobDestinationContact(allContacts, job)
    return { job, passengers, fareTotal, destinationContact }
  }), [allContacts, passengerFiles, sortedJobRecords])
  const flightRoutes = useMemo(() => jobOpsRows
    .filter(({ job }) => job.id !== holdingJobId && !['Complete', 'On Hold'].includes(job.status))
    .map(({ job, passengers }, index) => buildFlightRoutePlan(job, allContacts, currentPosition, cruiseSpeed, passengers.length, index))
    .filter((route): route is FlightRoutePlan => Boolean(route)), [allContacts, cruiseSpeed, currentPosition, jobOpsRows])
  const echoMailCounts = useMemo(() => echoMailFolderCounts(waves), [waves])
  const echoMailThreads = useMemo(() => createEchoMailThreads(waves, echoMailFolder, echoMailSearch), [echoMailFolder, echoMailSearch, waves])
  const echoMailPageCount = Math.max(1, Math.ceil(echoMailThreads.length / 20))
  const displayedEchoMailThreads = useMemo(() => echoMailThreads.slice(echoMailPage * 20, echoMailPage * 20 + 20), [echoMailPage, echoMailThreads])
  const selectedEchoThread = useMemo(
    () => echoMailThreads.find((thread) => thread.key === selectedEchoThreadKey) ?? displayedEchoMailThreads[0] ?? null,
    [displayedEchoMailThreads, echoMailThreads, selectedEchoThreadKey],
  )
  const pendingEchoWave = selectedEchoThread?.waves.find((wave) => wave.status === 'awaiting-response' && wave.direction === 'outgoing') ?? null
  const hailableTargets = useMemo(
    () => allContacts
      .filter(hailableContact)
      .map((contact) => ({ contact, distance: distanceMeters(currentPosition, contact) }))
      .sort((left, right) => {
        const leftPriority = left.contact.kind === 'station' ? 0 : left.contact.kind === 'body' ? 1 : left.contact.kind === 'relay' ? 2 : 3
        const rightPriority = right.contact.kind === 'station' ? 0 : right.contact.kind === 'body' ? 1 : right.contact.kind === 'relay' ? 2 : 3
        return leftPriority - rightPriority || left.distance - right.distance
      })
      .slice(0, 8),
    [allContacts, currentPosition],
  )
  const commandActionCount = telemetryAlerts.length + openSquawks.length + openCommitments.length + awaitingResponses
  const selectedShipOsAiModel = shipOsAiModels.find((model) => `${model.providerName}|${model.modelName}` === shipOsAiModelKey)
    ?? shipOsAiModels.find((model) => model.isDefault)
    ?? shipOsAiModels[0]
  const waveDraftActionCount = waveDraft.subject.trim() || waveDraft.body.trim() ? 1 : 0
  const crewByShift = useMemo(() => {
    const shifts = new Map<string, CrewMember[]>()
    normalizedCrewMembers.forEach((member) => {
      const shift = member.shift || 'Reserve'
      shifts.set(shift, [...(shifts.get(shift) ?? []), member])
    })
    return Array.from(shifts.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [normalizedCrewMembers])
  const departmentReadiness = useMemo(() => {
    const departments = new Map<string, CrewMember[]>()
    normalizedCrewMembers.forEach((member) => {
      const department = member.department || departmentFromRole(member.role)
      departments.set(department, [...(departments.get(department) ?? []), member])
    })
    return Array.from(departments.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [normalizedCrewMembers])
  const latestBlueprint = blueprintSnapshots[0] ?? null
  const bridgePollSeconds = normalizeBridgePollSeconds(bridgeConfig.pollSeconds)
  const displayedShipSystemRows = useMemo(() => {
    if (!lastTelemetryPacket) return shipSystemRows
    const totalBlocks = Number(lastTelemetryPacket.terminalBlockCount) || 0
    const damagedBlocks = Number(lastTelemetryPacket.nonFunctionalBlockCount) || 0
    const hullIntegrity = totalBlocks > 0 ? Math.max(0, 100 - (damagedBlocks / totalBlocks * 100)) : 98
    return [
      { name: 'Hull integrity', value: hullIntegrity, note: damagedBlocks > 0 ? `${damagedBlocks.toLocaleString()} non-functional blocks reported by telemetry.` : 'Live block-damage watch nominal.' },
      { name: 'Hydrogen reserve', value: telemetryPercent(lastTelemetryPacket.hydrogenPercent, 78), note: 'Live PB packet when tanks are named with Hydrogen.' },
      { name: 'Battery charge', value: telemetryPercent(lastTelemetryPacket.batteryPercent, 82), note: 'Live PB packet aggregated across batteries.' },
      { name: 'Jump drive charge', value: telemetryPercent(lastTelemetryPacket.jumpPercent, 74), note: 'Live PB packet aggregated across jump drives.' },
      { name: 'FTL readiness', value: telemetryPercent(lastTelemetryPacket.jumpPercent, 100), note: 'Live charge estimate; certified isolation remains under Bridge, Engineering, and local control.' },
      { name: 'Weapons status', value: lastTelemetryPacket.weaponCount ? 100 : 100, note: lastTelemetryPacket.weaponCount ? `${lastTelemetryPacket.weaponCount.toLocaleString()} weapon blocks reporting on-grid; ABIGAIL has no release authority.` : 'Military-derived array operational; ABIGAIL has no release authority.' },
      { name: 'Medical suite', value: 100, note: 'Ares Meridian refit complete with independent emergency feeds and reserve power.' },
      { name: 'Oxygen reserve', value: telemetryPercent(lastTelemetryPacket.oxygenPercent, 88), note: 'Live PB packet when tanks are named with Oxygen.' },
      { name: 'Reactor output', value: telemetryPercent(lastTelemetryPacket.reactorPercent, 64), note: 'Live PB packet aggregated across reactors.' },
      { name: 'Cargo volume', value: telemetryPercent(lastTelemetryPacket.cargoPercent, 0), note: 'Live PB packet from all ship inventories.' },
    ]
  }, [lastTelemetryPacket])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadAiModels = async () => {
      try {
        const response = await fetch('/api/ai/models', {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        })
        if (!response.ok) throw new Error(`Model catalog returned HTTP ${response.status}.`)
        const models = await response.json() as ShipOsAiModelOption[]
        if (cancelled || !models.length) return
        setShipOsAiModels(models)
        setShipOsAiModelKey((current) => {
          if (models.some((model) => `${model.providerName}|${model.modelName}` === current)) return current
          const preferred = models.find((model) => model.isDefault) ?? models[0]
          return `${preferred.providerName}|${preferred.modelName}`
        })
      } catch (error) {
        if (!cancelled) setShipOsAiError(error instanceof Error ? error.message : 'Unable to load the AI model catalog.')
      }
    }
    void loadAiModels()
    return () => { cancelled = true }
  }, [accessToken, setShipOsAiModelKey])

  useEffect(() => {
    const reportPersistenceError = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key
      setStateSyncStatus(`Storage error${key ? ` in ${key}` : ''}`)
    }
    window.addEventListener(shipOsPersistenceErrorEvent, reportPersistenceError)
    return () => window.removeEventListener(shipOsPersistenceErrorEvent, reportPersistenceError)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      setStateSyncStatus('Local storage only / sign in to synchronize')
      return
    }

    let cancelled = false
    let changeListener: (() => void) | null = null

    const saveState = async (expectedRevision: number | null) => {
      const response = await fetch('/api/shipos/state/carthage', {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: collectShipOsLocalState(), expectedRevision }),
      })
      if (response.status === 409) throw new Error('Campaign state changed on another console. Reload ShipOS before saving again.')
      if (!response.ok) throw new Error(`Campaign synchronization returned HTTP ${response.status}.`)
      const saved = await response.json() as ShipOsRemoteState
      remoteStateRevisionRef.current = saved.revision
      window.localStorage.setItem(shipOsRemoteRevisionKey, String(saved.revision))
      window.localStorage.setItem(shipOsRemoteUpdatedAtKey, saved.updatedAt)
      window.localStorage.removeItem(shipOsLocalDirtyAtKey)
      if (!cancelled) setStateSyncStatus(`Database synchronized / revision ${saved.revision}`)
      return saved
    }

    const hydrate = async () => {
      setStateSyncStatus('Loading campaign database')
      const response = await fetch('/api/shipos/state/carthage', {
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      })
      if (response.status === 404) {
        await saveState(null)
      } else {
        if (!response.ok) throw new Error(`Campaign synchronization returned HTTP ${response.status}.`)
        const remote = await response.json() as ShipOsRemoteState
        remoteStateRevisionRef.current = remote.revision
        const localState = collectShipOsLocalState()
        const localRevision = Number(window.localStorage.getItem(shipOsRemoteRevisionKey) || 0)
        const localDirtyAt = Number(window.localStorage.getItem(shipOsLocalDirtyAtKey) || 0)
        const remoteUpdatedAt = Date.parse(remote.updatedAt)
        const statesMatch = shipOsStateSignature(localState) === shipOsStateSignature(remote.state)

        if (!statesMatch && localRevision > 0 && localDirtyAt > remoteUpdatedAt) {
          await saveState(remote.revision)
        } else if (!statesMatch) {
          const hydratedKeys = applyShipOsRemoteState(remote.state)
          window.localStorage.setItem(shipOsRemoteRevisionKey, String(remote.revision))
          window.localStorage.setItem(shipOsRemoteUpdatedAtKey, remote.updatedAt)
          window.localStorage.removeItem(shipOsLocalDirtyAtKey)
          if (hydratedKeys.length > 0) {
            window.dispatchEvent(new CustomEvent(shipOsStateHydratedEvent, { detail: { keys: hydratedKeys } }))
          }
          setStateSyncStatus(`Database synchronized / revision ${remote.revision}`)
        } else {
          window.localStorage.setItem(shipOsRemoteRevisionKey, String(remote.revision))
          window.localStorage.setItem(shipOsRemoteUpdatedAtKey, remote.updatedAt)
          window.localStorage.removeItem(shipOsLocalDirtyAtKey)
          setStateSyncStatus(`Database synchronized / revision ${remote.revision}`)
        }
      }

      changeListener = () => {
        if (remoteStateSaveTimerRef.current !== null) window.clearTimeout(remoteStateSaveTimerRef.current)
        setStateSyncStatus('Campaign changes pending')
        remoteStateSaveTimerRef.current = window.setTimeout(() => {
          remoteStateSaveTimerRef.current = null
          void saveState(remoteStateRevisionRef.current).catch((error) => {
            if (!cancelled) setStateSyncStatus(error instanceof Error ? error.message : 'Campaign synchronization failed')
          })
        }, 1200)
      }
      window.addEventListener(shipOsStateChangedEvent, changeListener)
    }

    void hydrate().catch((error) => {
      if (!cancelled) setStateSyncStatus(error instanceof Error ? error.message : 'Campaign synchronization failed')
    })

    return () => {
      cancelled = true
      if (changeListener) window.removeEventListener(shipOsStateChangedEvent, changeListener)
      if (remoteStateSaveTimerRef.current !== null) window.clearTimeout(remoteStateSaveTimerRef.current)
    }
  }, [accessToken])

  useEffect(() => {
    telemetryHistoryRef.current = telemetryHistory
  }, [telemetryHistory])

  useEffect(() => {
    if (!Array.isArray(lastTelemetryPacket?.contacts)) return
    const contacts = contactsFromTelemetryPacket(lastTelemetryPacket)
      .filter((contact) => !isKnownPlanetaryChartContact(contact))
      .map((contact) => applyContactDispositionOverride(contact, contactDesignations[contact.id]))
      .map((contact) => applyContactFactionAssignment(contact, contactFactionAssignments[contact.id]))
    const seenAt = Number.isFinite(Date.parse(lastTelemetryPacket.stamp || '')) ? Date.parse(lastTelemetryPacket.stamp || '') : Date.now()
    setEncounterMemory((current) => mergeEncounterMemory(current, contacts, seenAt))
  }, [contactDesignations, contactFactionAssignments, lastTelemetryPacket, setEncounterMemory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(campaignSeedVersionKey) === campaignSeedVersion) return

    setCrewMembers((current) => upsertRecords(current, initialCrew, retiredCrewRecordIds))
    setCargoItems((current) => upsertRecords(current, initialCargo, retiredCargoRecordIds))
    setJobRecords((current) => upsertRecords(current, initialJobs, retiredJobRecordIds))
    setPassengerFiles((current) => upsertRecords(current, initialPassengerFiles, retiredPassengerFileIds))
    setBankEntries((current) => upsertRecords(current.filter((entry) => !entry.id.startsWith('bank-seed-')), createInitialBankEntries()))
    setWaves((current) => upsertRecords(current.filter((wave) => !wave.id.startsWith('wave-seed-')), createInitialWaves()))
    setShipLogs((current) => upsertRecords(current.filter((entry) => !entry.id.startsWith('log-seed-')), createInitialLogs()))
    setMetagameRecords((current) => upsertRecords(current, initialMetagameRecords))
    setSavedLocationRecords((current) => upsertRecords(current, initialLocationRecords))
    setDirectoryEntities((current) => upsertRecords(current, initialDirectoryEntities))
    setShipConfigurations((current) => upsertRecords(current, initialShipConfigurations, retiredShipConfigurationIds))
    setSquawkRecords((current) => upsertRecords(current, initialSquawks, retiredSquawkRecordIds))
    setCommitmentRecords((current) => upsertRecords(current, initialCommitments))
    setChronicleEntries((current) => upsertRecords(current, initialChronicle))
    setMedicalFacilities((current) => upsertRecords(current, initialMedicalFacilities))
    setSecurityIncidents((current) => upsertRecords(current, initialSecurityIncidents))
    setStoresRecords((current) => upsertRecords(current, initialStoresRecords))
    setNavigationPlan(createDefaultNavigationPlan())
    setSelectedJobId('job-ares-europa-pelagos-passage')
    window.localStorage.setItem(campaignSeedVersionKey, campaignSeedVersion)
  }, [setBankEntries, setCargoItems, setChronicleEntries, setCommitmentRecords, setCrewMembers, setDirectoryEntities, setJobRecords, setMedicalFacilities, setMetagameRecords, setNavigationPlan, setPassengerFiles, setSavedLocationRecords, setSecurityIncidents, setShipConfigurations, setShipLogs, setSquawkRecords, setStoresRecords, setWaves])

  useEffect(() => {
    setJobRecords((current) => current.some((job) => job.id === holdingJobId) ? current : [initialJobs[0], ...current])
  }, [setJobRecords])

  useEffect(() => {
    setCustomContacts((current) => {
      let changed = false
      const visibleContacts = current
        .filter((contact) => {
          const retainTelemetryOverride = !isTelemetryManagedContact(contact) || Boolean(contact.manualName || contact.manualRecord)
          const retain = !isHiddenTelemetryContact(contact) && retainTelemetryOverride
          if (!retain) changed = true
          return retain
        })
        .map((contact) => {
          if (contact.kind === 'asteroid' || contact.manualName) return contact
          const cleanName = cleanTelemetryContactName(contact.name)
          if (!cleanName || cleanName === contact.name) return contact
          changed = true
          return { ...contact, name: cleanName, sourceName: contact.sourceName || contact.name }
        })
      return changed ? visibleContacts : current
    })
  }, [customContacts, setCustomContacts])

  useEffect(() => {
    if (jobRecords.some((job) => job.id === selectedJobId)) return
    setSelectedJobId(jobRecords[0]?.id ?? holdingJobId)
  }, [jobRecords, selectedJobId])

  useEffect(() => {
    setEchoMailPage((current) => Math.min(current, echoMailPageCount - 1))
  }, [echoMailPageCount])

  const appendLog = useCallback((system: string, entry: string) => {
    setShipLogs((current) => [
      { id: `log-${Date.now()}-${Math.round(Math.random() * 10000)}`, stamp: Date.now(), system, entry },
      ...current,
    ].slice(0, 100))
  }, [setShipLogs])

  const triggerMasterCaution = useCallback((reason: string) => {
    setMasterAlarm((current) => current.level === 'critical'
      ? current
      : { level: 'caution', reason, triggeredAt: Date.now() })
    appendLog('MASTER ALARM', `CAUTION: ${reason}. Five-second automatic pulse.`)
  }, [appendLog])

  const triggerMasterWarning = useCallback((reason: string) => {
    setMasterAlarm({ level: 'critical', reason, triggeredAt: Date.now() })
    appendLog('MASTER ALARM', `WARNING: ${reason}. Alarm latched pending manual reset.`)
  }, [appendLog])

  const resetMasterAlarm = useCallback(() => {
    masterAlarmCriticalAcknowledgedRef.current = masterAlarmCriticalActiveRef.current
    setMasterAlarm({ level: 'normal', reason: 'Alarm acknowledged / systems under watch', triggeredAt: null })
    appendLog('MASTER ALARM', 'Latched warning acknowledged and reset from the tactical control panel.')
  }, [appendLog])

  const toggleAlarmSoundUplink = useCallback(() => {
    const enabled = !alarmSoundUplinkEnabled
    setAlarmSoundUplinkEnabled(enabled)
    appendLog('MASTER ALARM', `Alarm sound uplink ${enabled ? 'enabled' : 'disabled'} at the ShipOS console. Game-side command support remains pending.`)
  }, [alarmSoundUplinkEnabled, appendLog, setAlarmSoundUplinkEnabled])

  useEffect(() => {
    if (masterAlarmCriticalReason) {
      if (!masterAlarmCriticalActiveRef.current && !masterAlarmCriticalAcknowledgedRef.current) {
        triggerMasterWarning(masterAlarmCriticalReason)
      }
      masterAlarmCriticalActiveRef.current = true
      return
    }

    masterAlarmCriticalActiveRef.current = false
    masterAlarmCriticalAcknowledgedRef.current = false
  }, [masterAlarmCriticalReason, triggerMasterWarning])

  useEffect(() => {
    if (!masterAlarmCriticalReason && masterAlarmCautionActive && masterAlarmCautionArmedRef.current) {
      masterAlarmCautionArmedRef.current = false
      triggerMasterCaution(masterAlarmCautionReason)
    } else if (masterAlarmCautionClear) {
      masterAlarmCautionArmedRef.current = true
    }
  }, [masterAlarmCautionActive, masterAlarmCautionClear, masterAlarmCautionReason, masterAlarmCriticalReason, triggerMasterCaution])

  useEffect(() => {
    if (masterAlarm.level !== 'caution') return undefined
    const timer = window.setTimeout(() => {
      setMasterAlarm((current) => current.level === 'caution'
        ? { level: 'normal', reason: 'Caution pulse complete', triggeredAt: null }
        : current)
    }, masterAlarmCautionDurationMs)
    return () => window.clearTimeout(timer)
  }, [masterAlarm.level, masterAlarm.triggeredAt])

  const ingestTelemetryPacket = (packet: TelemetryPacket, importedBy: TelemetrySample['importedBy']) => {
    const sample = createTelemetrySample(packet, importedBy)
    const identity = telemetryPacketIdentity(sample)
    const currentHistory = telemetryHistoryRef.current
    const isDuplicate = Boolean(identity && currentHistory.some((historySample) => telemetryPacketIdentity(historySample) === identity))

    setLastTelemetryPacket(packet)
    if (!isDuplicate) {
      const nextHistory = [sample, ...currentHistory].slice(0, telemetryHistoryLimit)
      telemetryHistoryRef.current = nextHistory
      setTelemetryHistory(nextHistory)
    }
    const coordinate = coordinateFromTelemetry(packet)
    if (coordinate) setCurrentPosition(coordinate)
    const telemetryContacts = contactsFromTelemetryPacket(packet)
    const planetaryOverrides = planetaryOverridesFromTelemetryContacts(telemetryContacts)
    if (planetaryOverrides.length) {
      setPlanetaryChartOverrides((current) => {
        const next = { ...current }
        let changed = false
        planetaryOverrides.forEach(({ bodyId, override }) => {
          if (planetaryChartOverrideMatches(current[bodyId], override)) return
          next[bodyId] = override
          changed = true
        })
        return changed ? next : current
      })
    }
    const nonBodyContacts = telemetryContacts.filter((contact) => !isKnownPlanetaryChartContact(contact))
    if (Array.isArray(packet.contacts)) {
      setLiveTelemetryContacts(nonBodyContacts)
      const seenAt = Number.isFinite(Date.parse(packet.stamp || '')) ? Date.parse(packet.stamp || '') : Date.now()
      const memoryContacts = nonBodyContacts
        .map((contact) => applyContactDispositionOverride(contact, contactDesignations[contact.id]))
        .map((contact) => applyContactFactionAssignment(contact, contactFactionAssignments[contact.id]))
      setEncounterMemory((current) => mergeEncounterMemory(current, memoryContacts, seenAt))
    }
    if (isDuplicate) return false

    const alertText = buildTelemetryAlerts(packet, [sample, ...currentHistory]).map((alert) => `${alert.level} ${alert.label}`).join(', ')
    appendLog('TELEMETRY', `${importedBy === 'bridge' ? 'Bridge' : 'Manual'} uplink packet from ${packet.ship || packet.grid || 'unknown grid'}${coordinate ? ` at ${formatCoord(coordinate.x)}:${formatCoord(coordinate.y)}:${formatCoord(coordinate.z)}` : ''}.${nonBodyContacts.length ? ` Contacts: ${nonBodyContacts.length}.` : ''}${planetaryOverrides.length ? ` Chart bodies calibrated: ${planetaryOverrides.length}.` : ''}${alertText ? ` Alerts: ${alertText}.` : ''}`)
    return true
  }

  const clearTelemetryTrail = () => {
    setTelemetryHistory([])
    appendLog('TELEMETRY', 'Cleared live telemetry trail history.')
  }

  const resetBridgeEndpoint = () => {
    setBridgeError('')
    setBridgeConfig((current) => ({
      ...current,
      endpoint: defaultBridgeEndpoint,
      status: 'Local bridge endpoint reset',
      consecutiveFailures: 0,
    }))
  }

  const useCloudBridgeEndpoint = () => {
    setBridgeError('')
    setBridgeConfig((current) => ({
      ...current,
      endpoint: cloudBridgeEndpoint,
      autoPoll: true,
      status: 'EchoBoard relay selected / auto poll enabled',
      consecutiveFailures: 0,
    }))
  }

  const copyRemoteShipOsLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/shipos`)
      setBridgeError('')
      setBridgeConfig((current) => ({ ...current, status: 'Remote ShipOS link copied' }))
    } catch {
      setBridgeError(`Remote ShipOS URL: ${window.location.origin}/shipos`)
    }
  }

  const pollTelemetryBridge = async (options: { silent?: boolean } = {}) => {
    const endpoint = bridgeConfig.endpoint.trim()
    if (!endpoint) {
      setBridgeError('Bridge endpoint is empty.')
      return
    }
    setBridgeError('')
    setBridgeConfig((current) => ({ ...current, status: options.silent ? current.status : 'Polling bridge...', lastAttemptAt: Date.now() }))
    try {
      const result = await fetchBridgeWithFallback(endpoint, false, accessToken)
      const payload = result.payload
      const packet = parseBridgePacket(payload)
      const didImport = ingestTelemetryPacket(packet, 'bridge')
      const recovered = result.endpoint !== endpoint
      setBridgeConfig((current) => ({
        ...current,
        endpoint: result.endpoint,
        status: recovered ? 'Live packet received via local bridge fallback' : bridgePacketStatus(packet.stamp, didImport),
        lastAttemptAt: Date.now(),
        lastSuccessAt: Date.now(),
        consecutiveFailures: 0,
        latestStamp: packet.stamp || current.latestStamp,
      }))
      if (recovered) setBridgeError(`Configured endpoint failed; using ${result.endpoint}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bridge polling failed.'
      setBridgeError(message)
      setBridgeConfig((current) => ({
        ...current,
        endpoint,
        status: 'Bridge offline or unreachable',
        lastAttemptAt: Date.now(),
        consecutiveFailures: (current.consecutiveFailures ?? 0) + 1,
      }))
    }
  }

  const checkTelemetryBridgeHealth = async () => {
    const endpoint = bridgeConfig.endpoint.trim()
    setBridgeError('')
    setBridgeConfig((current) => ({ ...current, status: 'Checking bridge health...', lastAttemptAt: Date.now() }))
    try {
      const result = await fetchBridgeWithFallback(endpoint, true, accessToken)
      const payload = result.payload
      const health = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
      const healthStamp = typeof health.latestStamp === 'string' ? health.latestStamp : undefined
      const healthPacketAge = telemetryPacketAge(healthStamp)
      const recoveredEndpoint = bridgeTelemetryEndpointFromHealth(result.endpoint)
      const recovered = recoveredEndpoint !== endpoint
      setBridgeConfig((current) => ({
        ...current,
        endpoint: recoveredEndpoint,
        status: healthPacketAge !== null && healthPacketAge > 30000
          ? 'Relay online, game packet stale'
          : typeof health.status === 'string' ? `Bridge ${health.status}` : 'Bridge online',
        lastAttemptAt: Date.now(),
        lastHealthAt: Date.now(),
        consecutiveFailures: 0,
        packetCount: coerceTelemetryNumber(health.packetCount) ?? current.packetCount,
        latestStamp: healthStamp ?? current.latestStamp,
        bridgeUptimeSeconds: coerceTelemetryNumber(health.uptimeSeconds) ?? current.bridgeUptimeSeconds,
      }))
      if (recovered) setBridgeError(`Configured endpoint failed; using ${recoveredEndpoint}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bridge health check failed.'
      setBridgeError(message)
      setBridgeConfig((current) => ({
        ...current,
        status: 'Bridge health check failed',
        lastAttemptAt: Date.now(),
        consecutiveFailures: (current.consecutiveFailures ?? 0) + 1,
      }))
    }
  }

  const pairTelemetryRelay = async () => {
    if (!accessToken) {
      setBridgeError('Sign in to EchoBoard before creating a private relay key.')
      return
    }
    setRelayPairingBusy(true)
    setBridgeError('')
    try {
      const response = await fetch('/api/shipos/telemetry/pair', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: 'DSV Intrepid tray helper' }),
      })
      if (!response.ok) throw new Error(`Relay pairing returned HTTP ${response.status}.`)
      const pairing = await response.json() as ShipOsTelemetryPairing
      setRelayPairingKey(pairing.secret)
      await navigator.clipboard?.writeText(pairing.secret)
      setBridgeConfig((current) => ({ ...current, status: 'Private relay key created and copied' }))
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : 'Could not pair the telemetry relay.')
    } finally {
      setRelayPairingBusy(false)
    }
  }

  const copyRelayPairingKey = async () => {
    if (!relayPairingKey) return
    await navigator.clipboard.writeText(relayPairingKey)
    setBridgeConfig((current) => ({ ...current, status: 'Relay key copied' }))
  }

  pollTelemetryBridgeRef.current = pollTelemetryBridge

  useEffect(() => {
    if (!bridgeConfig.autoPoll) return
    const timer = window.setInterval(() => {
      void pollTelemetryBridgeRef.current({ silent: true })
    }, bridgePollSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [bridgeConfig.autoPoll, bridgeConfig.endpoint, bridgePollSeconds])

  const setNavigationDestination = (contact: ShipContact) => {
    setNavigationPlan((current) => ({ ...current, destinationId: contact.id }))
    setSelectedContactId(contact.id)
    setMapFocusContactId(contact.id)
    setMapFocusRequest((current) => current + 1)
    setActiveTab('flight')
    appendLog('NAV', `Navigation target set to ${contact.name}.`)
  }

  const selectNavigationDestinationById = (contactId: string) => {
    setNavigationPlan((current) => ({ ...current, destinationId: contactId }))
    const contact = allContacts.find((item) => item.id === contactId)
    if (!contact) return
    setSelectedContactId(contact.id)
    setMapFocusContactId(contact.id)
    setMapFocusRequest((current) => current + 1)
  }

  const focusLocationRecord = (location: LocationRecord) => {
    const existingContact = (location.contactId ? allContacts.find((contact) => contact.id === location.contactId) : null)
      ?? allContacts.find((contact) => contact.id === `loc-contact-${location.id}`)
    if (existingContact) {
      handleSelectContact(existingContact.id)
      return
    }

    const lowerClass = location.className.toLowerCase()
    const kind: ShipContactKind = lowerClass.includes('station') || lowerClass.includes('port') || lowerClass.includes('facility') ? 'station' : 'waypoint'
    const point: ShipContact = {
      id: `loc-contact-${location.id}`,
      name: location.name,
      className: location.className || 'Location record',
      kind,
      x: location.x,
      y: location.y,
      z: location.z,
      status: `${location.knowledgeState} location record`,
      color: kind === 'station' ? '#f6b94d' : '#ffdf8d',
      notes: `${location.whyHere} ${location.approachNotes}`.trim(),
    }

    setCustomContacts((current) => {
      const exists = current.some((contact) => contact.id === point.id)
      return exists ? current.map((contact) => contact.id === point.id ? point : contact) : [point, ...current]
    })
    setSelectedContactId(point.id)
    setMapFocusContactId(point.id)
    setMapFocusRequest((current) => current + 1)
    appendLog('NAV', `Location record focused: ${location.name}.`)
  }

  const focusLocationById = (locationId?: string) => {
    if (!locationId) return
    if (locationId === 'ship-current-position' || locationId === currentShipContactId) {
      handleSelectContact(currentShipContactId)
      return
    }
    const location = locationRecords.find((record) => record.id === locationId || record.contactId === locationId)
    if (location) focusLocationRecord(location)
  }

  const openJobPacket = (jobId?: string) => {
    if (!jobId || !jobRecords.some((job) => job.id === jobId)) return
    setSelectedJobId(jobId)
    setActiveTab('firstOfficer')
  }

  const setJobAsNavigationTarget = (job: JobRecord) => {
    const contact = findJobDestinationContact(allContacts, job)
    if (contact) {
      setNavigationDestination(contact)
      return
    }
    const point: ShipContact = {
      id: `custom-job-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      name: job.destination || job.title,
      className: 'Job Destination',
      kind: 'custom',
      x: currentPosition.x,
      y: currentPosition.y,
      z: currentPosition.z,
      status: 'Needs exact GPS',
      color: '#f6b94d',
      notes: `Created from job packet ${job.title}. Update this point with exact GPS when known.`,
    }
    setCustomContacts((current) => [point, ...current])
    setNavigationDestination(point)
  }

  const advanceJobStatus = (job: JobRecord, status: JobRecord['status']) => {
    setJobRecords((current) => current.map((item) => item.id === job.id ? { ...item, status } : item))
    appendLog('JOBS', `${job.title} moved to ${status}.`)
  }

  const settleJobToBank = (job: JobRecord) => {
    const passengers = passengerFiles.filter((file) => file.jobId === job.id)
    const fareTotal = passengers.reduce((total, file) => total + file.fare, 0)
    const total = job.payout + fareTotal
    if (total <= 0) return
    const entry: BankEntry = {
      id: `bank-job-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      date: currentIsoDate(),
      kind: 'income',
      vendor: job.client,
      category: 'Job Settlement',
      amount: total,
      recurring: false,
      notes: `${job.title}: ${formatCredits(job.payout)} contract payout plus ${formatCredits(fareTotal)} passenger fares.`,
    }
    setBankEntries((current) => [entry, ...current])
    setJobRecords((current) => current.map((item) => item.id === job.id ? { ...item, status: 'Complete' } : item))
    setPassengerFiles((current) => current.map((file) => file.jobId === job.id ? { ...file, status: 'Delivered' } : file))
    appendLog('BANK', `Settled ${job.title} into operating bank for ${formatCredits(total)}.`)
  }

  const sendJobOpsWave = (job: JobRecord) => {
    const contact = findJobDestinationContact(allContacts, job)
    const wave: Wave = {
      id: `wave-job-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      direction: 'outgoing',
      network: job.client.includes('Medical') ? 'Passenger Exchange' : 'Local Flight Guild',
      from: shipName,
      to: job.client,
      subject: `Ops update: ${job.title}`,
      body: `Current status ${job.status}. Destination ${job.destination}. ${contact ? `Nav target resolved as ${contact.name}.` : 'Exact GPS still pending.'}`,
      createdAt: Date.now(),
      status: 'awaiting-response',
      responseDueAt: Date.now() + 10 * 60 * 1000,
      priority: job.status === 'In Transit' ? 'priority' : 'routine',
      channel: contact?.kind === 'station' ? 'docking' : contact?.kind === 'body' ? 'ship-to-shore' : 'wave',
      contactId: contact?.id,
      contactName: contact ? contactFileTitle(contact) : undefined,
      clearanceStatus: contact ? 'Requested' : undefined,
    }
    setWaves((current) => [wave, ...current])
    appendLog('COMMS', `Ops wave sent for ${job.title}; response due in 10 minutes.`)
  }

  const postPayrollRun = () => {
    if (personnelPayroll <= 0) return
    const entry: BankEntry = {
      id: `bank-payroll-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      date: currentIsoDate(),
      kind: 'expense',
      vendor: 'DSV Intrepid Crew',
      category: 'Payroll',
      amount: personnelPayroll,
      recurring: false,
      notes: `Monthly payroll run for ${activePersonnel} active personnel.`,
    }
    setBankEntries((current) => [entry, ...current])
    appendLog('PERSONNEL', `Posted crew payroll run for ${formatCredits(personnelPayroll)}.`)
  }

  const importBlueprintFile = async (event: ChangeEvent<HTMLInputElement>) => {
    setBlueprintError('')
    const file = event.currentTarget.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const snapshot = parseBlueprintSnapshot(text, file.name)
      setBlueprintSnapshots((current) => [snapshot, ...current].slice(0, 4))
      appendLog('METAGAME', `Imported blueprint snapshot ${snapshot.name}: ${snapshot.blockCount.toLocaleString()} blocks across ${snapshot.gridCount} grid(s).`)
    } catch (error) {
      setBlueprintError(error instanceof Error ? error.message : 'Blueprint could not be parsed.')
    }
  }

  const handleSelectContact = useCallback((id: string) => {
    contactModalReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedContactId(id)
    setMapFocusContactId(id)
    setMapFocusRequest((current) => current + 1)
  }, [])

  const focusIntrepidOnMap = useCallback(() => {
    setMapCameraMode('overhead')
    setMapFocusContactId(currentShipContactId)
    setMapFocusRequest((current) => current + 1)
  }, [])

  const showForwardMapView = useCallback(() => {
    setMapCameraMode('forward')
    setMapFocusContactId(currentShipContactId)
  }, [])

  const setSelectedContactDesignation = (disposition: ContactDispositionId) => {
    if (!selectedContact || !selectedCanBeDesignated) return
    const previous = contactDesignations[selectedContact.id] ?? 'auto'
    if (previous === disposition) return
    setContactDesignations((current) => {
      const next = { ...current }
      if (disposition === 'auto') delete next[selectedContact.id]
      else next[selectedContact.id] = disposition
      return next
    })
    appendLog('SENSORS', `${contactFileTitle(selectedContact)} IFF designation set to ${contactDispositionLabel(disposition)}.`)
  }

  const ensureMetagameFactionRecord = (factionName: string, contact: ShipContact) => {
    const clean = normalizeFactionName(factionName)
    if (!clean) return
    setMetagameRecords((current) => {
      const exists = current.some((record) => record.kind === 'Faction' && factionKey(record.name) === factionKey(clean))
      if (exists) return current
      return [{
        id: `meta-faction-${Date.now()}-${Math.round(Math.random() * 10000)}`,
        kind: 'Faction',
        name: clean,
        visibility: 'Not Yet Established',
        status: 'Identified from sensor contact',
        tags: ['contact-faction', contact.kind],
        notes: `Created from contact file for ${contactFileTitle(contact)}.`,
        createdAt: Date.now(),
      }, ...current]
    })
  }

  const setSelectedContactFaction = (factionName: string) => {
    if (!selectedContact || !selectedCanAssignFaction) return
    const clean = normalizeFactionName(factionName)
    setModalDraft((current) => ({ ...current, factionName: clean }))
    setContactFactionAssignments((current) => {
      const next = { ...current }
      if (clean) next[selectedContact.id] = clean
      else delete next[selectedContact.id]
      return next
    })
    if (clean) ensureMetagameFactionRecord(clean, selectedContact)
    appendLog('SENSORS', `${contactFileTitle(selectedContact)} faction ${clean ? `assigned to ${clean}` : 'returned to automatic classification'}.`)
  }

  const attachImagesToSelectedContact = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) => file.type.startsWith('image/'))
    event.currentTarget.value = ''
    if (!selectedContact || !files.length) return

    setImageryError('')
    try {
      const prepared = await Promise.all(files.map((file) => prepareContactImageAttachment(file, selectedContact)))
      let projectedBytes = contactImageTotalBytes
      const accepted: ContactImageAttachment[] = []
      prepared.forEach((image) => {
        if (contactImages.length + accepted.length >= contactImageLibraryLimit) return
        if (projectedBytes + image.byteSize > contactImageStorageSoftLimit) return
        projectedBytes += image.byteSize
        accepted.push(image)
      })

      if (!accepted.length) {
        setImageryError(`Image library is near its local limit (${formatByteSize(contactImageTotalBytes)} stored). Delete older images before adding more.`)
        return
      }

      setContactImages((current) => [...accepted, ...current].slice(0, contactImageLibraryLimit))
      if (accepted.length < prepared.length) {
        setImageryError(`Attached ${accepted.length} of ${prepared.length}; local image storage is near ${formatByteSize(contactImageStorageSoftLimit)}.`)
      }
      appendLog('SENSORS', `Attached ${accepted.length} image${accepted.length === 1 ? '' : 's'} to ${contactFileTitle(selectedContact)}.`)
    } catch (error) {
      setImageryError(error instanceof Error ? error.message : 'Image attachment failed.')
    }
  }

  const updateContactImageCaption = (imageId: string, caption: string) => {
    setContactImages((current) => current.map((image) => image.id === imageId ? { ...image, caption } : image))
  }

  const deleteContactImage = (imageId: string) => {
    setContactImages((current) => current.filter((image) => image.id !== imageId))
  }

  const openImageContact = (contactId: string) => {
    handleSelectContact(contactId)
    setActiveTab('flight')
  }

  const setContactClassFilter = useCallback((id: ContactClassFilterId, enabled: boolean) => {
    setContactFilters((current) => {
      const normalized = normalizeContactFilters(current)
      return {
        ...normalized,
        classes: { ...normalized.classes, [id]: enabled },
      }
    })
  }, [setContactFilters])

  const setContactIffFilter = useCallback((id: ContactIffFilterId, enabled: boolean) => {
    setContactFilters((current) => {
      const normalized = normalizeContactFilters(current)
      return {
        ...normalized,
        iff: { ...normalized.iff, [id]: enabled },
      }
    })
  }, [setContactFilters])

  const setContactFactionFilter = useCallback((id: string, enabled: boolean) => {
    setContactFilters((current) => {
      const normalized = normalizeContactFilters(current, contactFactionOptions.map((option) => option.id))
      return {
        ...normalized,
        factions: { ...normalized.factions, [id]: enabled },
      }
    })
  }, [contactFactionOptions, setContactFilters])

  const setAllContactFilters = useCallback((enabled: boolean) => {
    const nextClasses = contactClassFilterOptions.reduce((filters, option) => {
      filters[option.id] = enabled
      return filters
    }, {} as Record<ContactClassFilterId, boolean>)
    const nextIff = contactIffFilterOptions.reduce((filters, option) => {
      filters[option.id] = enabled
      return filters
    }, {} as Record<ContactIffFilterId, boolean>)
    const nextFactions = contactFactionOptions.reduce((filters, option) => {
      filters[option.id] = enabled
      return filters
    }, {} as Record<string, boolean>)
    setContactFilters({ classes: nextClasses, iff: nextIff, factions: nextFactions })
  }, [contactFactionOptions, setContactFilters])

  useEffect(() => {
    if (!selectedContact) {
      modalDraftContactIdRef.current = null
      return
    }
    if (modalDraftContactIdRef.current === selectedContact.id) return
    modalDraftContactIdRef.current = selectedContact.id
    setModalDraft({
      name: contactFileTitle(selectedContact),
      className: selectedContact.className,
      factionName: contactFactionAssignments[selectedContact.id] ?? contactFactionName(selectedContact),
      notes: contactNotes[selectedContact.id] || selectedContact.notes,
    })
  }, [contactFactionAssignments, contactNotes, selectedContact])

  useEffect(() => {
    if (!selectedContactId) {
      const returnFocus = contactModalReturnFocusRef.current
      contactModalReturnFocusRef.current = null
      returnFocus?.focus()
      return
    }

    const modal = contactModalRef.current
    if (!modal) return
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    const firstFocusable = modal.querySelector<HTMLElement>(focusableSelector)
    ;(firstFocusable ?? modal).focus()

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelectedContactId(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
      if (!focusable.length) {
        event.preventDefault()
        modal.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [selectedContactId])

  useEffect(() => {
    if (!personnelFileSelection) {
      const returnFocus = personnelFileReturnFocusRef.current
      personnelFileReturnFocusRef.current = null
      returnFocus?.focus()
      return
    }

    const modal = personnelFileModalRef.current
    if (!modal) return
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    const firstFocusable = modal.querySelector<HTMLElement>(focusableSelector)
    ;(firstFocusable ?? modal).focus()

    const handlePersonnelModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPersonnelFileSelection(null)
        setEditingCrewId(null)
        setEditingPassengerId(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
      if (!focusable.length) {
        event.preventDefault()
        modal.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handlePersonnelModalKeyDown)
    return () => window.removeEventListener('keydown', handlePersonnelModalKeyDown)
  }, [personnelFileSelection])

  useEffect(() => {
    const checkResponses = window.setInterval(() => {
      setWaves((current) => {
        const replies: Wave[] = []
        const updated = current.map((wave) => {
          if (wave.status === 'awaiting-response' && wave.responseDueAt && wave.responseDueAt <= Date.now()) {
            replies.push(generateRelayReply(wave))
            return { ...wave, status: 'responded' as const }
          }
          return wave
        })
        return replies.length ? [...replies, ...updated] : current
      })
    }, 15000)

    return () => window.clearInterval(checkResponses)
  }, [setWaves])

  useEffect(() => {
    if (!autoWaveEnabled) return
    const randomWave = window.setInterval(() => {
      setWaves((current) => [createRandomWave(crewMembers), ...current])
    }, 600000)

    return () => window.clearInterval(randomWave)
  }, [autoWaveEnabled, crewMembers, setWaves])

  const plotWaypoint = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const x = Number(waypointDraft.x)
    const y = Number(waypointDraft.y)
    const z = Number(waypointDraft.z)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return

    const point: ShipContact = {
      id: `${waypointDraft.kind}-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      name: waypointDraft.name.trim() || 'Unlabeled Plot',
      className: waypointDraft.className.trim() || defaultClassForContactKind(waypointDraft.kind),
      kind: waypointDraft.kind,
      x,
      y,
      z,
      status: statusForContactKind(waypointDraft.kind),
      color: colorForContactKind(waypointDraft.kind),
      notes: waypointDraft.notes.trim(),
    }

    setCustomContacts((current) => [point, ...current])
    setSelectedContactId(point.id)
    setMapFocusContactId(point.id)
    setMapFocusRequest((current) => current + 1)
    setWaypointDraft(createDefaultWaypointDraft(waypointDraft.kind))
    appendLog('SENSORS', `Plotted point ${point.name} at GPS ${formatCoord(x)}:${formatCoord(y)}:${formatCoord(z)}.`)
  }

  const importGpsPoints = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const contacts = parseSpaceEngineersGpsLines(gpsImportDraft)
    if (!contacts.length) return
    setCustomContacts((current) => [...contacts, ...current])
    setSelectedContactId(contacts[0].id)
    setMapFocusContactId(contacts[0].id)
    setMapFocusRequest((current) => current + 1)
    setGpsImportDraft('')
    appendLog('SENSORS', `Imported ${contacts.length} GPS point${contacts.length === 1 ? '' : 's'} into the sensor map.`)
  }

  const simulateSensorSweep = () => {
    const contactSpecs: Array<{ kind: ShipContactKind; name: string; range: number }> = [
      { kind: 'asteroid', name: 'Asteroid Return', range: 65000 },
      { kind: 'radar', name: 'Radar Contact', range: 118000 },
      { kind: 'signal', name: 'Unidentified Signal', range: 184000 },
    ]
    const contacts = contactSpecs.map((spec, index): ShipContact => {
      const angle = Math.random() * Math.PI * 2
      const vertical = (Math.random() - 0.5) * spec.range * 0.36
      const distance = spec.range * (0.65 + Math.random() * 0.85)
      return {
        id: `${spec.kind}-${Date.now()}-${index}-${Math.round(Math.random() * 10000)}`,
        name: `${spec.name} ${Math.round(Math.random() * 900 + 100)}`,
        className: defaultClassForContactKind(spec.kind),
        kind: spec.kind,
        x: currentPosition.x + Math.cos(angle) * distance,
        y: currentPosition.y + vertical,
        z: currentPosition.z + Math.sin(angle) * distance,
        status: statusForContactKind(spec.kind),
        color: colorForContactKind(spec.kind),
        notes: 'Generated by ShipOS simulated sensor sweep. Replace with live sensor/bridge data when available.',
      }
    })
    setCustomContacts((current) => [...contacts, ...current])
    setSelectedContactId(contacts[0].id)
    setMapFocusContactId(contacts[0].id)
    setMapFocusRequest((current) => current + 1)
    appendLog('SENSORS', `Simulated sensor sweep resolved ${contacts.length} contacts.`)
  }

  const saveContactModal = () => {
    if (!selectedContact) return
    const factionName = normalizeFactionName(modalDraft.factionName)
    setContactNotes((current) => ({ ...current, [selectedContact.id]: modalDraft.notes }))
    if (selectedCanAssignFaction) {
      setContactFactionAssignments((current) => {
        const next = { ...current }
        if (factionName) next[selectedContact.id] = factionName
        else delete next[selectedContact.id]
        return next
      })
      if (factionName) ensureMetagameFactionRecord(factionName, selectedContact)
    }
    if (selectedIsCustom) {
      const manualName = modalDraft.name.trim()
      setCustomContacts((current) => current.map((contact) => contact.id === selectedContact.id
        ? { ...contact, name: manualName || contact.name, manualName: Boolean(manualName), manualRecord: true, className: modalDraft.className.trim() || contact.className, notes: modalDraft.notes }
        : contact))
    } else if (selectedIsLiveTelemetry) {
      const manualName = modalDraft.name.trim()
      const savedOverride: ShipContact = {
        ...selectedContact,
        name: manualName || selectedContact.name,
        manualName: Boolean(manualName),
        manualRecord: true,
        telemetryManaged: true,
        className: modalDraft.className.trim() || selectedContact.className,
        notes: modalDraft.notes,
      }
      setCustomContacts((current) => [savedOverride, ...current.filter((contact) => contact.id !== selectedContact.id)])
    }
    appendLog('SENSORS', `Updated contact file for ${modalDraft.name || selectedContact.name}.`)
  }

  const deleteSelectedContact = () => {
    if (!selectedContact || !selectedIsCustom) return
    setCustomContacts((current) => current.filter((contact) => contact.id !== selectedContact.id))
    setContactDesignations((current) => {
      const next = { ...current }
      delete next[selectedContact.id]
      return next
    })
    setContactFactionAssignments((current) => {
      const next = { ...current }
      delete next[selectedContact.id]
      return next
    })
    setSelectedContactId(null)
    appendLog('SENSORS', `Deleted plotted point ${selectedContact.name}.`)
  }

  const updateCurrentFromContact = () => {
    if (!selectedContact) return
    setCurrentPosition({ x: selectedContact.x, y: selectedContact.y, z: selectedContact.z })
    setSelectedContactId(currentShipContactId)
    setMapFocusContactId(currentShipContactId)
    setMapFocusRequest((current) => current + 1)
    appendLog('NAV', `Current position updated to ${selectedContact.name}.`)
  }

  const sendWave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!waveDraft.subject.trim() || !waveDraft.body.trim()) return
    const dueAt = Date.now() + 10 * 60 * 1000
    const linkedContact = allContacts.find((contact) => contact.id === waveDraft.contactId)
    const fee = waveDraft.channel === 'docking' || waveDraft.channel === 'ship-to-shore'
      ? dockingFeeForWave({
        id: waveDraft.contactId || waveDraft.subject,
        direction: 'outgoing',
        network: waveDraft.network,
        from: shipName,
        to: waveDraft.to,
        subject: waveDraft.subject,
        body: waveDraft.body,
        createdAt: Date.now(),
        status: 'awaiting-response',
        channel: waveDraft.channel,
      })
      : 0
    const wave: Wave = {
      id: `wave-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      direction: 'outgoing',
      network: waveDraft.network,
      from: shipName,
      to: waveDraft.to.trim() || waveDraft.network,
      subject: waveDraft.subject.trim(),
      body: waveDraft.body.trim(),
      createdAt: Date.now(),
      status: 'awaiting-response',
      responseDueAt: dueAt,
      crewTarget: waveDraft.crewTarget || undefined,
      priority: waveDraft.priority,
      channel: waveDraft.channel,
      contactId: linkedContact?.id,
      contactName: linkedContact ? contactFileTitle(linkedContact) : undefined,
      clearanceStatus: isHailChannel(waveDraft.channel) ? 'Requested' : undefined,
      feesCredits: fee || undefined,
    }
    setWaves((current) => [wave, ...current])
    setWaveDraft((current) => ({ ...current, subject: '', body: '' }))
    setEchoMailFolder(isHailChannel(wave.channel) ? 'hails' : 'sent')
    setSelectedEchoThreadKey(waveThreadKey(wave))
    appendLog('COMMS', `Wave sent on ${wave.network}; response due in 10 minutes.`)
  }

  const requestShipOsAiBrief = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!shipOsAiPrompt.trim() || !selectedShipOsAiModel || shipOsAiBusy) return
    if (!accessToken) {
      setShipOsAiError('Sign in to EchoBoard before sending command data to ABIGAIL.')
      return
    }

    setShipOsAiBusy(true)
    setShipOsAiError('')
    try {
      const operationalContext = {
        ship: shipName,
        shipTime: currentShipTime,
        voyage: currentVoyageLabel,
        operationalStatus: currentOperationalStatus,
        position: currentPosition,
        destination: {
          name: plannedDestination.name,
          range: formatKm(routeDistance),
          eta: routeEta,
        },
        telemetry: {
          packetStamp: lastTelemetryPacket?.stamp ?? null,
          speed: lastTelemetryPacket?.speed ?? null,
          batteryPercent: lastTelemetryPacket?.batteryPercent ?? null,
          hydrogenPercent: lastTelemetryPacket?.hydrogenPercent ?? null,
          oxygenPercent: lastTelemetryPacket?.oxygenPercent ?? null,
          jumpPercent: lastTelemetryPacket?.jumpPercent ?? null,
          alerts: telemetryAlerts,
        },
        command: {
          actionItems: commandActionCount,
          openSquawks: openSquawks.slice(0, 8),
          openCommitments: openCommitments.slice(0, 8),
          awaitingResponses,
          activeIncidents: securityIncidents.slice(0, 8),
        },
        crew: {
          active: activePersonnel,
          recruiting: recruitingPersonnel,
          passengers: activePassengerFiles,
          soulsAboard: currentSoulsAboard,
        },
        finance: {
          operatingBalance,
          recurringMonthlyBurn,
        },
        selectedEchoMail: selectedEchoThread ? {
          subject: baseWaveSubject(selectedEchoThread.latest.subject),
          from: selectedEchoThread.latest.from,
          to: selectedEchoThread.latest.to,
          network: selectedEchoThread.latest.network,
          body: selectedEchoThread.latest.body,
          pending: selectedEchoThread.pendingCount,
        } : null,
      }
      const response = await fetch('/api/gaming/shipos/ai/brief', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerName: selectedShipOsAiModel.providerName,
          modelName: selectedShipOsAiModel.modelName,
          content: shipOsAiPrompt.trim(),
          context: JSON.stringify(operationalContext),
        }),
      })
      const payload = await response.json().catch(() => null) as ShipOsAiResponse | { error?: string } | null
      if (!response.ok) throw new Error(payload && 'error' in payload && payload.error ? payload.error : `ABIGAIL returned HTTP ${response.status}.`)
      const result = payload as ShipOsAiResponse
      setShipOsAiReply(result.reply)
      appendLog('ABIGAIL', `Command analysis completed with ${result.providerName} / ${result.modelName}.`)
    } catch (error) {
      setShipOsAiError(error instanceof Error ? error.message : 'ABIGAIL command analysis failed.')
    } finally {
      setShipOsAiBusy(false)
    }
  }

  const useShipOsAiReplyAsWave = () => {
    if (!shipOsAiReply.trim()) return
    setWaveDraft((current) => ({
      ...current,
      subject: current.subject || 'ABIGAIL operational advisory',
      body: shipOsAiReply.trim(),
    }))
  }

  const generateImmediateWave = () => {
    const wave = createRandomWave(crewMembers)
    setWaves((current) => [wave, ...current])
    appendLog('COMMS', `Incoming wave received from ${wave.from}.`)
  }

  const prepareHailDraft = (contact: ShipContact) => {
    const draft = createHailDraftForContact(contact, currentPosition)
    setWaveDraft(draft)
    setEchoMailFolder('hails')
    setActiveTab('captain')
    appendLog('COMMS', `Prepared ${waveChannelLabel(draft.channel)} draft for ${contactFileTitle(contact)}.`)
  }

  const resolveSelectedEchoThreadNow = () => {
    if (!pendingEchoWave) return
    const reply = generateRelayReply(pendingEchoWave)
    setWaves((current) => [
      reply,
      ...current.map((wave) => wave.id === pendingEchoWave.id ? { ...wave, status: 'responded' as const } : wave),
    ])
    setEchoMailFolder(isHailChannel(reply.channel) ? 'hails' : 'inbox')
    setSelectedEchoThreadKey(waveThreadKey(reply))
    appendLog('COMMS', `${reply.from} replied to ${baseWaveSubject(reply.subject)}.`)
  }

  const deleteWave = (wave: Wave) => {
    if (!window.confirm(`Delete wave "${baseWaveSubject(wave.subject)}"?`)) return
    const threadKey = waveThreadKey(wave)
    const threadHasRemainingWaves = waves.some((item) => item.id !== wave.id && waveThreadKey(item) === threadKey)
    setWaves((current) => current.filter((item) => item.id !== wave.id))
    if (selectedEchoThreadKey === threadKey && !threadHasRemainingWaves) setSelectedEchoThreadKey('')
    appendLog('COMMS', `Deleted wave ${baseWaveSubject(wave.subject)} from ${wave.network}.`)
  }

  const deleteEchoMailThread = (thread: EchoMailThread) => {
    if (!window.confirm(`Delete EchoMail thread "${baseWaveSubject(thread.latest.subject)}" and ${thread.waves.length} wave${thread.waves.length === 1 ? '' : 's'}?`)) return
    const waveIds = new Set(thread.waves.map((wave) => wave.id))
    setWaves((current) => current.filter((wave) => !waveIds.has(wave.id)))
    if (selectedEchoThreadKey === thread.key) setSelectedEchoThreadKey('')
    appendLog('COMMS', `Deleted EchoMail thread ${baseWaveSubject(thread.latest.subject)} with ${thread.waves.length} wave${thread.waves.length === 1 ? '' : 's'}.`)
  }

  const addCrewMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!crewDraft.name.trim() || !crewDraft.role.trim()) return
    const member = crewMemberFromDraft(crewDraft)
    setCrewMembers((current) => [member, ...current])
    setCrewDraft(createDefaultCrewDraft())
    appendLog('PERSONNEL', `Added ${member.name} to the personnel system as ${member.billet}.`)
  }

  const startEditingCrewMember = (member: CrewMember) => {
    personnelFileReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingCrewId(member.id)
    setCrewEditDraft(crewDraftFromMember(member))
    setPersonnelFileSelection({ kind: 'crew', id: member.id })
  }

  const cancelEditingCrewMember = () => {
    setEditingCrewId(null)
    setCrewEditDraft(createDefaultCrewDraft())
    if (personnelFileSelection?.kind === 'crew') setPersonnelFileSelection(null)
  }

  const saveCrewMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingCrewId || !crewEditDraft.name.trim() || !crewEditDraft.role.trim()) return
    const existing = normalizedCrewMembers.find((member) => member.id === editingCrewId)
    if (!existing) return
    const updated = crewMemberFromDraft(crewEditDraft, existing)
    setCrewMembers((current) => current.map((member) => member.id === editingCrewId ? updated : member))
    appendLog('PERSONNEL', `Updated personnel record for ${updated.name}.`)
    cancelEditingCrewMember()
  }

  const removeCrewMember = (member: CrewMember) => {
    if (member.id === 'crew-hales') return
    setCrewMembers((current) => current.filter((item) => item.id !== member.id))
    if (editingCrewId === member.id) cancelEditingCrewMember()
    appendLog('PERSONNEL', `Removed personnel record for ${member.name}.`)
  }

  const updateSquawkState = (squawk: SquawkRecord, state: SquawkState) => {
    setSquawkRecords((current) => current.map((item) => item.id === squawk.id ? { ...item, state } : item))
    appendLog('ENGINEERING', `Squawk ${squawk.title} moved to ${state}.`)
  }

  const setCommitmentStatus = (commitment: CommitmentRecord, status: CommitmentRecord['status']) => {
    setCommitmentRecords((current) => current.map((item) => item.id === commitment.id ? { ...item, status } : item))
    appendLog('COMMITMENTS', `${commitment.person}: ${commitment.promise} marked ${status}.`)
  }

  const recordChronicleEntry = (entry: ChronicleEntry) => {
    setChronicleEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: 'Recorded', stamp: Date.now() } : item))
    appendLog('CHRONICLE', `Recorded milestone: ${entry.title}.`)
  }

  const addJobRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!jobDraft.title.trim()) return
    const job = jobRecordFromDraft(jobDraft)
    setJobRecords((current) => [job, ...current])
    setSelectedJobId(job.id)
    setPassengerDraft(createDefaultPassengerDraft(job.id))
    setJobDraft(createDefaultJobDraft())
    appendLog('JOBS', `Created job packet ${job.title}.`)
  }

  const startEditingJob = (job: JobRecord) => {
    setEditingJobId(job.id)
    setJobEditDraft(jobDraftFromRecord(job))
  }

  const cancelEditingJob = () => {
    setEditingJobId(null)
    setJobEditDraft(createDefaultJobDraft())
  }

  const saveJobRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingJobId || !jobEditDraft.title.trim()) return
    const existing = jobRecords.find((job) => job.id === editingJobId)
    if (!existing) return
    const updated = jobRecordFromDraft(jobEditDraft, existing)
    setJobRecords((current) => current.map((job) => job.id === editingJobId ? updated : job))
    appendLog('JOBS', `Updated job packet ${updated.title}.`)
    cancelEditingJob()
  }

  const deleteJobRecord = (job: JobRecord) => {
    if (job.id === holdingJobId) return
    setJobRecords((current) => current.filter((item) => item.id !== job.id))
    setPassengerFiles((current) => current.map((file) => file.jobId === job.id ? { ...file, jobId: holdingJobId } : file))
    if (selectedJobId === job.id) setSelectedJobId(holdingJobId)
    if (editingJobId === job.id) cancelEditingJob()
    appendLog('JOBS', `Deleted job packet ${job.title}; attached passenger files moved to holding.`)
  }

  const appendPassengerToJob = (job: JobRecord) => {
    setSelectedJobId(job.id)
    setPassengerDraft((current) => ({
      ...current,
      jobId: job.id,
      destination: current.destination || job.destination,
      origin: current.origin || 'Asterion Orbital',
    }))
  }

  const addPassengerFile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passengerDraft.name.trim()) return
    const file = passengerFileFromDraft(passengerDraft)
    setPassengerFiles((current) => [file, ...current])
    setSelectedJobId(file.jobId)
    setPassengerDraft(createDefaultPassengerDraft(file.jobId))
    appendLog('JOBS', `Added passenger file ${file.name} to ${jobRecords.find((job) => job.id === file.jobId)?.title ?? 'holding'}.`)
  }

  const startEditingPassengerFile = (file: PassengerFile) => {
    personnelFileReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingPassengerId(file.id)
    setPassengerEditDraft(passengerDraftFromFile(file))
    setPersonnelFileSelection({ kind: 'passenger', id: file.id })
  }

  const cancelEditingPassengerFile = () => {
    setEditingPassengerId(null)
    setPassengerEditDraft(createDefaultPassengerDraft(selectedJobId))
    if (personnelFileSelection?.kind === 'passenger') setPersonnelFileSelection(null)
  }

  const closePersonnelFile = () => {
    if (personnelFileSelection?.kind === 'crew') cancelEditingCrewMember()
    else if (personnelFileSelection?.kind === 'passenger') cancelEditingPassengerFile()
    else setPersonnelFileSelection(null)
  }

  const savePassengerFile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingPassengerId || !passengerEditDraft.name.trim()) return
    const existing = passengerFiles.find((file) => file.id === editingPassengerId)
    if (!existing) return
    const updated = passengerFileFromDraft(passengerEditDraft, existing)
    setPassengerFiles((current) => current.map((file) => file.id === editingPassengerId ? updated : file))
    setSelectedJobId(updated.jobId)
    appendLog('JOBS', `Updated passenger file ${updated.name}.`)
    cancelEditingPassengerFile()
  }

  const deletePassengerFile = (file: PassengerFile) => {
    setPassengerFiles((current) => current.filter((item) => item.id !== file.id))
    if (editingPassengerId === file.id) cancelEditingPassengerFile()
    appendLog('JOBS', `Deleted passenger file ${file.name}.`)
  }

  const addCargoItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const quantity = Number(cargoDraft.quantity)
    const mass = Number(cargoDraft.mass)
    if (!cargoDraft.name.trim() || !Number.isFinite(quantity) || !Number.isFinite(mass)) return
    const item: CargoItem = {
      id: `cargo-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      name: cargoDraft.name.trim(),
      category: cargoDraft.category.trim() || 'Cargo',
      quantity,
      mass,
      bay: cargoDraft.bay.trim() || 'Unassigned',
    }
    setCargoItems((current) => [item, ...current])
    setCargoDraft({ name: '', category: 'Resource', quantity: '', mass: '', bay: '' })
    appendLog('CARGO', `Cargo manifest added ${item.name}.`)
  }

  const importTelemetryPacket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTelemetryError('')
    try {
      const trimmedPacket = telemetryDraft.trim()
      if (!trimmedPacket) throw new Error('Paste a telemetry JSON packet first.')
      const packet = parseTelemetryPacket(trimmedPacket)
      ingestTelemetryPacket(packet, 'manual')
      setTelemetryDraft('')
    } catch (error) {
      setTelemetryError(error instanceof Error ? error.message : 'Telemetry packet could not be parsed.')
    }
  }

  const selectPlanetaryCalibrationBody = (bodyId: string) => {
    const body = calibratedStarSystemBodies.find((item) => item.id === bodyId) ?? calibratedStarSystemBodies[0]
    if (!body) return
    setPlanetaryCalibrationError('')
    setPlanetaryCalibrationDraft(planetaryCalibrationDraftFromBody(body))
  }

  const savePlanetaryCalibration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPlanetaryCalibrationError('')
    const body = calibratedStarSystemBodies.find((item) => item.id === planetaryCalibrationDraft.bodyId)
    const x = Number(planetaryCalibrationDraft.x)
    const y = Number(planetaryCalibrationDraft.y)
    const z = Number(planetaryCalibrationDraft.z)
    if (!body || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      setPlanetaryCalibrationError('Choose a body and enter valid X/Y/Z center coordinates.')
      return
    }
    const override: PlanetaryChartOverride = {
      x,
      y,
      z,
      source: 'Manual chart calibration',
      updatedAt: Date.now(),
    }
    setPlanetaryChartOverrides((current) => ({ ...current, [body.id]: override }))
    setPlanetaryCalibrationDraft((current) => ({ ...current, x: String(Math.round(x)), y: String(Math.round(y)), z: String(Math.round(z)) }))
    appendLog('NAV', `${body.name} chart center calibrated to ${formatCoord(x)}:${formatCoord(y)}:${formatCoord(z)}.`)
  }

  const importPlanetaryCalibrationGps = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPlanetaryCalibrationError('')
    const parsed = parsePlanetCalibrationGpsLines(planetaryCalibrationDraft.gpsLines)
    if (!parsed.length) {
      setPlanetaryCalibrationError('Paste GPS center lines named for known bodies, for example GPS:Helena:x:y:z:.')
      return
    }
    setPlanetaryChartOverrides((current) => {
      const next = { ...current }
      parsed.forEach(({ bodyId, coordinate, name }) => {
        next[bodyId] = {
          ...coordinate,
          source: `GPS chart calibration (${name})`,
          originalName: name,
          updatedAt: Date.now(),
        }
      })
      return next
    })
    const firstBody = calibratedStarSystemBodies.find((body) => body.id === parsed[0].bodyId) ?? starSystemBodies.find((body) => body.id === parsed[0].bodyId)
    if (firstBody) {
      setPlanetaryCalibrationDraft({
        bodyId: firstBody.id,
        x: String(Math.round(parsed[0].coordinate.x)),
        y: String(Math.round(parsed[0].coordinate.y)),
        z: String(Math.round(parsed[0].coordinate.z)),
        gpsLines: '',
      })
    } else {
      setPlanetaryCalibrationDraft((current) => ({ ...current, gpsLines: '' }))
    }
    appendLog('NAV', `Imported ${parsed.length} planetary chart calibration point${parsed.length === 1 ? '' : 's'}.`)
  }

  const resetSelectedPlanetaryCalibration = () => {
    const body = starSystemBodies.find((item) => item.id === planetaryCalibrationDraft.bodyId)
    if (!body) return
    setPlanetaryChartOverrides((current) => {
      const next = { ...current }
      delete next[body.id]
      return next
    })
    setPlanetaryCalibrationError('')
    setPlanetaryCalibrationDraft(planetaryCalibrationDraftFromBody(body))
    appendLog('NAV', `${body.name} chart center reset to Star System preset.`)
  }

  const resetAllPlanetaryCalibrations = () => {
    setPlanetaryChartOverrides({})
    setPlanetaryCalibrationError('')
    setPlanetaryCalibrationDraft(createDefaultPlanetaryCalibrationDraft(planetaryCalibrationDraft.bodyId))
    appendLog('NAV', 'Planetary chart calibration reset to Star System preset.')
  }

  const loadSelectedBodyIntoCalibration = () => {
    if (!selectedContact || selectedContact.kind !== 'body') return
    setPlanetaryCalibrationDraft(planetaryCalibrationDraftFromBody(selectedContact))
    appendLog('NAV', `${selectedContact.name} loaded into planetary chart calibration.`)
  }

  const addBankEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Math.abs(Number(bankDraft.amount))
    if (!bankDraft.vendor.trim() || !bankDraft.category.trim() || !Number.isFinite(amount) || amount <= 0) return
    const entry: BankEntry = {
      id: `bank-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      date: bankDraft.date || currentIsoDate(),
      kind: bankDraft.kind,
      vendor: bankDraft.vendor.trim(),
      category: bankDraft.category.trim(),
      amount,
      recurring: bankDraft.recurring,
      notes: bankDraft.notes.trim(),
    }
    setBankEntries((current) => [entry, ...current])
    setBankDraft((current) => ({ ...current, vendor: '', amount: '', notes: '', recurring: false }))
    appendLog('BANK', `${entry.kind === 'income' ? 'Logged income' : 'Logged expense'} ${formatCredits(entry.amount)} for ${entry.vendor}.`)
  }

  const saveGeneratedPortrait = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const existing = editingGeneratedPortraitId ? generatedPortraits.find((portrait) => portrait.id === editingGeneratedPortraitId) : undefined
    const portrait = portraitFromDraft(portraitMakerDraft, existing)
    setGeneratedPortraits((current) => existing
      ? current.map((item) => item.id === existing.id ? portrait : item)
      : [portrait, ...current])
    setPortraitMakerDraft(createDefaultPortraitDraft())
    setEditingGeneratedPortraitId(null)
    appendLog('METAGAME', `${existing ? 'Updated' : 'Created'} metagame portrait ${portrait.name}.`)
  }

  const startEditingGeneratedPortrait = (portrait: GeneratedPortrait) => {
    setEditingGeneratedPortraitId(portrait.id)
    setPortraitMakerDraft(portraitDraftFromGenerated(portrait))
  }

  const cancelEditingGeneratedPortrait = () => {
    setEditingGeneratedPortraitId(null)
    setPortraitMakerDraft(createDefaultPortraitDraft())
  }

  const deleteGeneratedPortrait = (portrait: GeneratedPortrait) => {
    setGeneratedPortraits((current) => current.filter((item) => item.id !== portrait.id))
    setCrewMembers((current) => current.map((member) => member.portraitId === portrait.id ? { ...member, portraitId: defaultPortraitIdForRecord(member.name, member.role) } : member))
    setPassengerFiles((current) => current.map((file) => file.portraitId === portrait.id ? { ...file, portraitId: defaultPortraitIdForRecord(file.name, `Passenger ${file.status}`) } : file))
    if (editingGeneratedPortraitId === portrait.id) cancelEditingGeneratedPortrait()
    appendLog('METAGAME', `Deleted metagame portrait ${portrait.name}.`)
  }

  const applyPortraitToCrewIntake = (portrait: GeneratedPortrait) => {
    setCrewDraft((current) => ({ ...current, portraitId: portrait.id }))
    setActiveTab('firstOfficer')
    appendLog('METAGAME', `Assigned ${portrait.name} to the new hire portrait field.`)
  }

  const applyPortraitToPassengerIntake = (portrait: GeneratedPortrait) => {
    setPassengerDraft((current) => ({ ...current, portraitId: portrait.id }))
    setActiveTab('firstOfficer')
    appendLog('METAGAME', `Assigned ${portrait.name} to the passenger intake portrait field.`)
  }

  const saveMetagameRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!metagameDraft.name.trim()) return
    const existing = editingMetagameId ? metagameRecords.find((record) => record.id === editingMetagameId) : undefined
    const record = metagameRecordFromDraft(metagameDraft, existing)
    setMetagameRecords((current) => existing
      ? current.map((item) => item.id === existing.id ? record : item)
      : [record, ...current])
    setMetagameDraft(createDefaultMetagameDraft())
    setEditingMetagameId(null)
    appendLog('METAGAME', `${existing ? 'Updated' : 'Created'} backstage record ${record.name}.`)
  }

  const startEditingMetagameRecord = (record: MetagameRecord) => {
    setEditingMetagameId(record.id)
    setMetagameDraft(metagameDraftFromRecord(record))
  }

  const cancelEditingMetagameRecord = () => {
    setEditingMetagameId(null)
    setMetagameDraft(createDefaultMetagameDraft())
  }

  const deleteMetagameRecord = (record: MetagameRecord) => {
    setMetagameRecords((current) => current.filter((item) => item.id !== record.id))
    if (editingMetagameId === record.id) cancelEditingMetagameRecord()
    appendLog('METAGAME', `Deleted backstage record ${record.name}.`)
  }

  const exportCampaignBackup = () => {
    const backup = {
      format: 'shipos-carthage-backup-v1',
      exportedAt: new Date().toISOString(),
      state: collectShipOsLocalState(true),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `shipos-carthage-${currentIsoDate()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importCampaignBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as { format?: string; state?: Record<string, unknown> }
      if (payload.format !== 'shipos-carthage-backup-v1' || !payload.state || typeof payload.state !== 'object') {
        throw new Error('This is not a ShipOS Carthage backup file.')
      }
      if (!window.confirm('Restore this ShipOS backup? Current browser records will be replaced where the backup contains matching files.')) return
      applyShipOsBackupState(payload.state)
      window.localStorage.setItem(shipOsLocalDirtyAtKey, String(Date.now()))
      window.location.reload()
    } catch (error) {
      setStateSyncStatus(error instanceof Error ? error.message : 'Campaign backup could not be restored')
    }
  }

  const renderJobForm = (
    draft: JobDraft,
    setDraft: Dispatch<SetStateAction<JobDraft>>,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    title: string,
    meta: string,
    submitLabel: string,
    onCancel?: () => void,
  ) => (
    <form className="shipOsPanel shipOsJobForm" onSubmit={onSubmit}>
      <header><span>{title}</span><strong>{meta}</strong></header>
      <label><span>Job Title</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="shipOsCoordInputs">
        <label><span>Client</span><input value={draft.client} onChange={(event) => setDraft((current) => ({ ...current, client: event.target.value }))} /></label>
        <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as JobRecord['status'] }))}>
          <option>Prospect</option>
          <option>Booked</option>
          <option>Boarding</option>
          <option>In Transit</option>
          <option>Complete</option>
          <option>On Hold</option>
        </select></label>
        <label><span>Payout</span><input value={draft.payout} onChange={(event) => setDraft((current) => ({ ...current, payout: event.target.value }))} inputMode="decimal" /></label>
      </div>
      <label><span>Route</span><input value={draft.route} onChange={(event) => setDraft((current) => ({ ...current, route: event.target.value }))} /></label>
      <label><span>Destination</span><input value={draft.destination} onChange={(event) => setDraft((current) => ({ ...current, destination: event.target.value }))} /></label>
      <div className="shipOsCoordInputs">
        <label><span>Departure</span><input type="date" value={draft.departure} onChange={(event) => setDraft((current) => ({ ...current, departure: event.target.value }))} /></label>
        <label><span>Due</span><input type="date" value={draft.due} onChange={(event) => setDraft((current) => ({ ...current, due: event.target.value }))} /></label>
      </div>
      <label><span>Notes</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
      <div className="shipOsActionRow">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )

  const renderPassengerForm = (
    draft: PassengerDraft,
    setDraft: Dispatch<SetStateAction<PassengerDraft>>,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    title: string,
    meta: string,
    submitLabel: string,
    onCancel?: () => void,
  ) => (
    <form className="shipOsPanel shipOsPassengerForm" onSubmit={onSubmit}>
      <header><span>{title}</span><strong>{meta}</strong></header>
      <PortraitSelector value={draft.portraitId} customPortraits={generatedPortraits} onChange={(portraitId) => setDraft((current) => ({ ...current, portraitId }))} />
      <label><span>Passenger Name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
      <div className="shipOsCoordInputs">
        <label><span>Job</span><select value={draft.jobId} onChange={(event) => setDraft((current) => ({ ...current, jobId: event.target.value }))}>{sortedJobRecords.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
        <label><span>Manifest ID</span><input value={draft.manifestId} onChange={(event) => setDraft((current) => ({ ...current, manifestId: event.target.value }))} placeholder="Auto if blank" /></label>
        <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as PassengerFile['status'] }))}>
          <option>Prospect</option>
          <option>Booked</option>
          <option>Boarded</option>
          <option>In Transit</option>
          <option>Delivered</option>
          <option>Flagged</option>
          <option>Declined</option>
        </select></label>
      </div>
      <div className="shipOsCoordInputs">
        <label><span>Origin</span><input value={draft.origin} onChange={(event) => setDraft((current) => ({ ...current, origin: event.target.value }))} /></label>
        <label><span>Destination</span><input value={draft.destination} onChange={(event) => setDraft((current) => ({ ...current, destination: event.target.value }))} /></label>
        <label><span>Cabin / Berth</span><input value={draft.cabin} onChange={(event) => setDraft((current) => ({ ...current, cabin: event.target.value }))} /></label>
      </div>
      <div className="shipOsCoordInputs">
        <label><span>Fare</span><input value={draft.fare} onChange={(event) => setDraft((current) => ({ ...current, fare: event.target.value }))} inputMode="decimal" /></label>
        <label><span>Baggage kg</span><input value={draft.baggageKg} onChange={(event) => setDraft((current) => ({ ...current, baggageKg: event.target.value }))} inputMode="decimal" /></label>
        <label><span>Risk</span><input value={draft.risk} onChange={(event) => setDraft((current) => ({ ...current, risk: event.target.value }))} /></label>
      </div>
      <label><span>Clearance</span><input value={draft.clearance} onChange={(event) => setDraft((current) => ({ ...current, clearance: event.target.value }))} /></label>
      <label><span>Contact</span><input value={draft.contact} onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))} /></label>
      <label><span>Medical</span><input value={draft.medical} onChange={(event) => setDraft((current) => ({ ...current, medical: event.target.value }))} /></label>
      <label><span>Notes</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
      <div className="shipOsActionRow">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )

  const renderCrewForm = (
    draft: CrewFormDraft,
    setDraft: Dispatch<SetStateAction<CrewFormDraft>>,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    title: string,
    meta: string,
    submitLabel: string,
    onCancel?: () => void,
  ) => (
    <form className="shipOsPanel shipOsPersonnelForm shipOsPersonnelEditForm" onSubmit={onSubmit}>
      <header><span>{title}</span><strong>{meta}</strong></header>
      <PortraitSelector value={draft.portraitId} customPortraits={generatedPortraits} onChange={(portraitId) => setDraft((current) => ({ ...current, portraitId }))} />
      <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
      <label><span>Role</span><input value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} /></label>
      <div className="shipOsCoordInputs">
        <label><span>Department</span><input value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} /></label>
        <label><span>Service No.</span><input value={draft.serviceNumber} onChange={(event) => setDraft((current) => ({ ...current, serviceNumber: event.target.value }))} /></label>
        <label><span>Monthly Rate</span><input value={draft.rateMonthly} onChange={(event) => setDraft((current) => ({ ...current, rateMonthly: event.target.value }))} inputMode="numeric" /></label>
      </div>
      <label><span>Billet</span><input value={draft.billet} onChange={(event) => setDraft((current) => ({ ...current, billet: event.target.value }))} /></label>
      <label><span>Contract</span><input value={draft.contractStatus} onChange={(event) => setDraft((current) => ({ ...current, contractStatus: event.target.value }))} /></label>
      <div className="shipOsCoordInputs">
        <label><span>Registry</span><input value={draft.registryStanding} onChange={(event) => setDraft((current) => ({ ...current, registryStanding: event.target.value }))} /></label>
        <label><span>Quarters</span><input value={draft.quarters} onChange={(event) => setDraft((current) => ({ ...current, quarters: event.target.value }))} /></label>
        <label><span>Medical</span><input value={draft.medicalStatus} onChange={(event) => setDraft((current) => ({ ...current, medicalStatus: event.target.value }))} /></label>
      </div>
      <label><span>Shift</span><input value={draft.shift} onChange={(event) => setDraft((current) => ({ ...current, shift: event.target.value }))} /></label>
      <label><span>Status</span><input value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} /></label>
      <label><span>Clearance</span><input value={draft.clearance} onChange={(event) => setDraft((current) => ({ ...current, clearance: event.target.value }))} /></label>
      <label><span>Credentials</span><input value={draft.credentials} onChange={(event) => setDraft((current) => ({ ...current, credentials: event.target.value }))} /></label>
      <label><span>Notes</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
      <div className="shipOsActionRow">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )

  const renderTab = () => {
    if (activeTab === 'telemetry') {
      return (
        <section className="shipOsTelemetryWorkspace" aria-label="ShipOS telemetry workspace">
          <section className="shipOsPanel shipOsTelemetryCommand">
            <header><span>Telemetry / Live Operations</span><strong>{bridgeConfig.status}</strong></header>
            <dl className="shipOsTelemetryKpis">
              <div><dt>Packet Age</dt><dd>{telemetryPacketAgeLabel(lastTelemetryPacket?.stamp)}</dd></div>
              <div><dt>Source</dt><dd>{lastTelemetryPacket?.source || 'No uplink'}</dd></div>
              <div><dt>Speed</dt><dd>{formatMetersPerSecond(lastTelemetryPacket?.speed)}</dd></div>
              <div><dt>Altitude AGL</dt><dd>{formatAltitude(lastTelemetryPacket?.surfaceAltitude)}</dd></div>
              <div><dt>Vertical</dt><dd>{formatSignedSpeed(lastTelemetryPacket?.verticalSpeed)}</dd></div>
              <div><dt>Alerts</dt><dd>{telemetryAlerts.length}</dd></div>
            </dl>
            <div className="shipOsActionRow shipOsTelemetryPrimaryActions">
              <button type="button" onClick={() => pollTelemetryBridge()}>Poll now</button>
              <button type="button" onClick={checkTelemetryBridgeHealth}>Check health</button>
              <button type="button" onClick={useCloudBridgeEndpoint}>Use EchoBoard relay</button>
              <button type="button" onClick={resetBridgeEndpoint}>Use local bridge</button>
            </div>
          </section>

          <section className="shipOsPanel shipOsTelemetryVitals">
            <header><span>Flight, Motion & Integrity</span><strong>{telemetryHistory.length} packets retained</strong></header>
            <dl className="shipOsDataList shipOsTelemetryDataGrid">
              <div><dt>Velocity</dt><dd>{formatVector3(lastTelemetryPacket?.velocityX, lastTelemetryPacket?.velocityY, lastTelemetryPacket?.velocityZ, 'm/s')}</dd></div>
              <div><dt>Horizontal Speed</dt><dd>{formatMetersPerSecond(lastTelemetryPacket?.horizontalSpeed)}</dd></div>
              <div><dt>Vertical Speed</dt><dd>{formatSignedSpeed(lastTelemetryPacket?.verticalSpeed)}</dd></div>
              <div><dt>Surface Altitude</dt><dd>{formatAltitude(lastTelemetryPacket?.surfaceAltitude)}</dd></div>
              <div><dt>Sea-Level Altitude</dt><dd>{formatAltitude(lastTelemetryPacket?.seaLevelAltitude)}</dd></div>
              <div><dt>Gravity</dt><dd>{Number.isFinite(lastTelemetryPacket?.naturalGravity) ? `${Number(lastTelemetryPacket?.naturalGravity).toFixed(2)} g` : 'No packet'}</dd></div>
              <div><dt>Dampeners</dt><dd>{formatTelemetryFlag(lastTelemetryPacket?.dampeners, 'Enabled', 'Disabled')}</dd></div>
              <div><dt>Ship Mass</dt><dd>{formatMass(lastTelemetryPacket?.mass)}</dd></div>
              <div><dt>Trail Distance</dt><dd>{formatKm(telemetryDistance)}</dd></div>
              <div><dt>Average Speed</dt><dd>{formatMetersPerSecond(averageTelemetrySpeed)}</dd></div>
              <div><dt>Block Watch</dt><dd>{Number.isFinite(lastTelemetryPacket?.terminalBlockCount) ? `${Number(lastTelemetryPacket?.terminalBlockCount).toLocaleString()} total / ${Number(lastTelemetryPacket?.nonFunctionalBlockCount ?? 0).toLocaleString()} damaged` : 'No packet'}</dd></div>
              <div><dt>Route</dt><dd>{plannedDestination.name} / {routeEta}</dd></div>
            </dl>
            <div className="shipOsAlertList shipOsTelemetryAlerts">
              {telemetryAlerts.length === 0 ? (
                <article>
                  <span>Clear</span>
                  <strong>No telemetry alerts</strong>
                  <p>Reserves, cargo, speed envelope, integrity, and abrupt position changes are within the current watch criteria.</p>
                </article>
              ) : telemetryAlerts.map((alert) => (
                <article key={`${alert.level}-${alert.label}`} className={alert.level.toLowerCase()}>
                  <span>{alert.level}</span>
                  <strong>{alert.label}</strong>
                  <p>{alert.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="shipOsPanel shipOsTelemetryStatus">
            <header><span>Latest Packet Diagnostics</span><strong>{lastTelemetryPacket?.stamp ?? 'No packet'}</strong></header>
            {lastTelemetryPacket ? (
              <dl className="shipOsDataList shipOsTelemetryPacketGrid">
                <div><dt>Ship / Grid</dt><dd>{lastTelemetryPacket.ship || lastTelemetryPacket.grid || 'Unknown'}</dd></div>
                <div><dt>Protocol</dt><dd>{lastTelemetryPacket.protocol || 'Legacy/manual'}</dd></div>
                <div><dt>Source</dt><dd>{lastTelemetryPacket.source || 'Unknown'}{lastTelemetryPacket.modVersion ? ` v${lastTelemetryPacket.modVersion}` : ''}</dd></div>
                <div><dt>Controller</dt><dd>{lastTelemetryPacket.controller || 'Unlisted'}</dd></div>
                <div><dt>Packet</dt><dd>{lastTelemetryPacket.sequence !== undefined ? `#${lastTelemetryPacket.sequence}` : lastTelemetryPacket.packetId || 'Unsequenced'}</dd></div>
                <div><dt>Position</dt><dd>{formatCoord(currentPosition.x)}:{formatCoord(currentPosition.y)}:{formatCoord(currentPosition.z)}</dd></div>
                <div><dt>Cargo</dt><dd>{Number.isFinite(lastTelemetryPacket.cargoPercent) ? `${Number(lastTelemetryPacket.cargoPercent).toFixed(1)}%` : 'No packet'}</dd></div>
                <div><dt>Docking</dt><dd>{Number.isFinite(lastTelemetryPacket.connectedConnectorCount) ? `${Number(lastTelemetryPacket.connectedConnectorCount).toLocaleString()} / ${Number(lastTelemetryPacket.connectorCount ?? 0).toLocaleString()} connectors` : 'No packet'}</dd></div>
                <div><dt>Landing Gear</dt><dd>{Number.isFinite(lastTelemetryPacket.lockedLandingGearCount) ? `${Number(lastTelemetryPacket.lockedLandingGearCount).toLocaleString()} / ${Number(lastTelemetryPacket.landingGearCount ?? 0).toLocaleString()} locked` : 'No packet'}</dd></div>
                <div><dt>Vents</dt><dd>{Number.isFinite(lastTelemetryPacket.pressurizedVentCount) ? `${Number(lastTelemetryPacket.pressurizedVentCount).toLocaleString()} / ${Number(lastTelemetryPacket.airVentCount ?? 0).toLocaleString()} pressurized` : 'No packet'}</dd></div>
                <div><dt>Weapons / Tools</dt><dd>{Number.isFinite(lastTelemetryPacket.weaponCount) ? `${Number(lastTelemetryPacket.weaponCount).toLocaleString()} / ${Number(lastTelemetryPacket.toolCount ?? 0).toLocaleString()}` : 'No packet'}</dd></div>
                <div><dt>Received By</dt><dd>{telemetryHistory[0]?.importedBy || 'Unknown'}</dd></div>
              </dl>
            ) : (
              <article className="shipOsEmptyState"><strong>No live packet</strong><span>Start the local helper or import a packet manually below.</span></article>
            )}
          </section>

          <section className="shipOsPanel shipOsSystems shipOsTelemetrySystems">
            <header><span>Live Ship Systems</span><strong>{lastTelemetryPacket ? 'Packet driven' : 'Fallback model'}</strong></header>
            {displayedShipSystemRows.map((system) => (
              <div key={system.name} className="shipOsMeter">
                <div><span>{system.name}</span><strong>{system.value}%</strong></div>
                <i style={{ width: `${system.value}%` }} />
                <small>{system.note}</small>
              </div>
            ))}
          </section>

          <section className="shipOsPanel shipOsBridgeConsole shipOsTelemetryBridge">
            <header><span>Relay & Bridge</span><strong>{bridgeConfig.status}</strong></header>
            <div className={`shipOsRelayAccess ${isSignedIn && canUseRelay ? 'ready' : 'locked'}`}>
              <div>
                <span>Remote Device Access</span>
                <strong>{!isSignedIn ? 'Sign in to EchoBoard Gaming on this device' : canUseRelay ? `${accountName} authorized` : `${accountName} is signed in read-only`}</strong>
                <small>{!isSignedIn
                  ? 'Authentication is stored per browser; phones and tablets sign in separately.'
                  : canUseRelay
                    ? 'This browser may read the private campaign relay.'
                    : 'Campaign write access is required for private telemetry.'}</small>
              </div>
              {!isSignedIn
                ? <button type="button" onClick={onSignIn}>Sign in</button>
                : canUseRelay
                  ? <button type="button" onClick={useCloudBridgeEndpoint}>Connect relay</button>
                  : <button type="button" onClick={onSignOut}>Change account</button>}
            </div>
            <div className="shipOsBridgeEndpointRow">
              <label><span>Bridge Endpoint</span><input value={bridgeConfig.endpoint} onChange={(event) => setBridgeConfig((current) => ({ ...current, endpoint: event.target.value }))} /></label>
              <label className="shipOsCheckRow"><input type="checkbox" checked={Boolean(bridgeConfig.autoPoll)} onChange={(event) => setBridgeConfig((current) => ({ ...current, autoPoll: event.target.checked }))} /><span>Auto poll</span></label>
              <label><span>Seconds</span><input type="number" min="2" max="120" value={bridgePollSeconds} onChange={(event) => setBridgeConfig((current) => ({ ...current, pollSeconds: normalizeBridgePollSeconds(Number(event.target.value)) }))} /></label>
            </div>
            <div className="shipOsActionRow">
              <button type="button" onClick={() => pollTelemetryBridge()}>Poll once</button>
              <button type="button" onClick={checkTelemetryBridgeHealth}>Health check</button>
              <button type="button" onClick={copyRemoteShipOsLink}>Copy remote link</button>
              <button type="button" onClick={pairTelemetryRelay} disabled={relayPairingBusy}>{relayPairingBusy ? 'Pairing...' : 'Create relay key'}</button>
            </div>
            {relayPairingKey && (
              <div className="shipOsRelayPairing" role="status">
                <span>Relay key / shown once</span>
                <code>{relayPairingKey}</code>
                <button type="button" onClick={copyRelayPairingKey}>Copy key</button>
                <p>Pair this key from the helmet tray helper on the Space Engineers PC.</p>
              </div>
            )}
            {bridgeError && <small className="shipOsTelemetryError">{bridgeError}</small>}
            <dl className="shipOsDataList shipOsBridgeDiagnostics">
              <div><dt>Last Success</dt><dd>{bridgeConfig.lastSuccessAt ? new Date(bridgeConfig.lastSuccessAt).toLocaleTimeString() : 'None'}</dd></div>
              <div><dt>Failures</dt><dd>{(bridgeConfig.consecutiveFailures ?? 0).toLocaleString()}</dd></div>
              <div><dt>Bridge Packets</dt><dd>{bridgeConfig.packetCount !== undefined ? bridgeConfig.packetCount.toLocaleString() : 'Unknown'}</dd></div>
              <div><dt>Uptime</dt><dd>{bridgeConfig.bridgeUptimeSeconds ? formatDurationFromSeconds(bridgeConfig.bridgeUptimeSeconds) : 'Unknown'}</dd></div>
              <div><dt>Latest Stamp</dt><dd>{bridgeConfig.latestStamp || 'None'}</dd></div>
              <div><dt>Packet Age</dt><dd>{telemetryPacketAgeLabel(bridgeConfig.latestStamp)}</dd></div>
            </dl>
          </section>

          <details className="shipOsPanel shipOsTelemetryAdapters">
            <summary>
              <span>Adapters, Downloads & Manual Intake</span>
              <strong>Open when configuring the uplink</strong>
            </summary>
            <form className="shipOsTelemetryManualForm" onSubmit={importTelemetryPacket}>
              <label><span>Telemetry Packet JSON</span><textarea value={telemetryDraft} onChange={(event) => setTelemetryDraft(event.target.value)} placeholder='{"ship":"DSV Intrepid","x":42000,"y":142000,"z":-98000,"speed":0}' /></label>
              {telemetryError && <small className="shipOsTelemetryError">{telemetryError}</small>}
              <div className="shipOsActionRow">
                <button type="submit">Import packet</button>
                <button type="button" onClick={clearTelemetryTrail}>Clear trail</button>
                <a href="/shipos/addons/intrepid-telemetry-uplink.cs" download>PB script</a>
                <a href="/shipos/addons/shipos-helper.zip" download>Tray helper</a>
                <a href="/shipos/addons/start-shipos-helper-tray.cmd" download>Restart helper</a>
                <a href="/shipos/addons/install-shipos-helper-shortcut.cmd" download>Desktop shortcut</a>
                <a href="/shipos/addons/shipos-local-telemetry-mod.zip" download>Local mod</a>
                <a href="/shipos/addons/shipos-client-plugin.zip" download>Client plugin</a>
                <a href="/shipos/addons/shipos-uplink-readme.md" download>Uplink notes</a>
              </div>
            </form>
          </details>
        </section>
      )
    }

    if (activeTab === 'flight') {
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Kessa Vale / Flight</span><strong>Persistent flight memory</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Current GPS</dt><dd>{formatCoord(currentPosition.x)}:{formatCoord(currentPosition.y)}:{formatCoord(currentPosition.z)}</dd></div>
              <div><dt>Destination</dt><dd>{plannedDestination.name}</dd></div>
              <div><dt>Range</dt><dd>{formatKm(routeDistance)}</dd></div>
              <div><dt>ETA</dt><dd>{routeEta}</dd></div>
              <div><dt>Known Locations</dt><dd>{locationRecords.length}</dd></div>
              <div><dt>Flight Trail</dt><dd>{telemetryHistory.length} packets</dd></div>
            </dl>
            <p>Flight owns navigation, known approach data, GPS intake, contact imagery, plotted routes, and repeat-approach memory. The global map above remains the shared tactical display.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Route Planner</span><strong>{plannedDestination.name}</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Distance</dt><dd>{(routeDistance / 1000).toFixed(1)} km</dd></div>
              <div><dt>Cruise ETA</dt><dd>{routeEta}</dd></div>
              <div><dt>Target GPS</dt><dd>{formatCoord(plannedDestination.x)}:{formatCoord(plannedDestination.y)}:{formatCoord(plannedDestination.z)}</dd></div>
              <div><dt>Last Speed</dt><dd>{formatMetersPerSecond(lastTelemetryPacket?.speed)}</dd></div>
            </dl>
            <label><span>Destination</span><select value={navigationPlan.destinationId} onChange={(event) => selectNavigationDestinationById(event.target.value)}>
              {allContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} | {contact.className}</option>)}
            </select></label>
            <div className="shipOsCoordInputs">
              <label><span>Cruise m/s</span><input value={navigationPlan.cruiseSpeed} onChange={(event) => setNavigationPlan((current) => ({ ...current, cruiseSpeed: event.target.value }))} inputMode="decimal" /></label>
              <label><span>Fuel reserve %</span><input value={navigationPlan.fuelReserve} onChange={(event) => setNavigationPlan((current) => ({ ...current, fuelReserve: event.target.value }))} inputMode="decimal" /></label>
            </div>
            <label><span>Route Notes</span><textarea value={navigationPlan.notes} onChange={(event) => setNavigationPlan((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="shipOsActionRow">
              <button type="button" disabled={!selectedContact || selectedContact.id === currentShipContactId} onClick={updateCurrentFromContact}>Move Intrepid to selected contact</button>
              {selectedContact && selectedContact.id !== currentShipContactId && <button type="button" onClick={() => setNavigationDestination(selectedContact)}>Project path to selected contact</button>}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Relative Contacts</span><strong>{nearbyContacts.length} / {allContacts.length}</strong></header>
            <button type="button" className={selectedContactId === currentShipContactId ? 'shipOsCurrentPositionButton active' : 'shipOsCurrentPositionButton'} aria-pressed={selectedContactId === currentShipContactId} onClick={() => handleSelectContact(currentShipContactId)}>
              <span>You are here</span>
              <strong>{currentShipContact.name}</strong>
              <small>{formatCoord(currentPosition.x)}:{formatCoord(currentPosition.y)}:{formatCoord(currentPosition.z)}</small>
            </button>
            <div className="shipOsContactSearchBar">
              <label>
                <span>Search Contacts</span>
                <input value={contactSearchText} onChange={(event) => setContactSearchText(event.target.value)} placeholder="Name, faction, IFF, GPS, source..." />
              </label>
              {contactSearchText && <button type="button" onClick={() => setContactSearchText('')}>Clear</button>}
            </div>
            <div className="shipOsContactSortBar" aria-label="Contact sort controls">
              {contactSortOptions.map((option) => {
                const active = normalizedContactSort.key === option.id
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={active ? 'active' : ''}
                    aria-pressed={active}
                    onClick={() => setContactSortState((current) => nextContactSortState(current, option.id))}
                    title={`Sort contacts by ${option.label}`}
                  >
                    <span>{option.label}</span>
                    <strong aria-hidden="true">{contactSortArrow(normalizedContactSort, option.id)}</strong>
                  </button>
                )
              })}
            </div>
            <div className="shipOsContactList">
              {nearbyContacts.map(({ contact, distance }) => (
                <button type="button" key={contact.id} className={contact.id === selectedContactId ? 'active' : ''} aria-pressed={contact.id === selectedContactId} onClick={() => handleSelectContact(contact.id)}>
                  <span>{contactKindLabel(contact.kind)} | {contactFactionName(contact) ? `${contactFactionName(contact)} | ` : ''}{contact.relationship ? `${contact.relationship} | ` : ''}{contact.contactSource ? `${contact.contactSource} | ` : ''}{contact.className}</span>
                  <strong>{mapLabelForContact(contact)}</strong>
                  <small>{contact.kind === 'asteroid' ? `${contact.name} | ` : ''}{(distance / 1000).toFixed(1)} km relative | {contact.status}</small>
                </button>
              ))}
              {!nearbyContacts.length && (
                <article className="shipOsEmptyState">
                  <strong>No contacts visible</strong>
                  <span>Adjust Sensor Layer Filters or clear contact search to restore hidden contacts.</span>
                </article>
              )}
            </div>
            {selectedLocationRecord && (
              <article className="shipOsLinkedRecord">
                <span>{selectedLocationRecord.knowledgeState} | {selectedLocationRecord.confidence}</span>
                <strong>{selectedLocationRecord.name}</strong>
                <p>{selectedLocationRecord.whyHere}</p>
                <small>{selectedLocationRecord.body} | {selectedLocationRecord.landingSuitability}</small>
              </article>
            )}
            <button type="button" onClick={simulateSensorSweep}>Simulate sensor sweep</button>
          </div>
          <form className="shipOsPanel shipOsPlotForm" onSubmit={plotWaypoint}>
            <header><span>Plot Coordinate</span><strong>{contactKindLabel(waypointDraft.kind)}</strong></header>
            <label><span>Name</span><input value={waypointDraft.name} onChange={(event) => setWaypointDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Contact Type</span><select value={waypointDraft.kind} onChange={(event) => {
              const kind = event.target.value as ShipContactKind
              setWaypointDraft((current) => ({
                ...current,
                kind,
                className: !current.className || plottedContactKinds.some((item) => item.className === current.className)
                  ? defaultClassForContactKind(kind)
                  : current.className,
              }))
            }}>{plottedContactKinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</select></label>
            <label><span>Class</span><input value={waypointDraft.className} onChange={(event) => setWaypointDraft((current) => ({ ...current, className: event.target.value }))} /></label>
            <div className="shipOsCoordInputs">
              <label><span>X</span><input value={waypointDraft.x} onChange={(event) => setWaypointDraft((current) => ({ ...current, x: event.target.value }))} inputMode="decimal" /></label>
              <label><span>Y</span><input value={waypointDraft.y} onChange={(event) => setWaypointDraft((current) => ({ ...current, y: event.target.value }))} inputMode="decimal" /></label>
              <label><span>Z</span><input value={waypointDraft.z} onChange={(event) => setWaypointDraft((current) => ({ ...current, z: event.target.value }))} inputMode="decimal" /></label>
            </div>
            <label><span>Notes</span><textarea value={waypointDraft.notes} onChange={(event) => setWaypointDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit">Plot point</button>
          </form>
          <form className="shipOsPanel shipOsGpsImportForm" onSubmit={importGpsPoints}>
            <header><span>GPS Intake</span><strong>Space Engineers</strong></header>
            <label><span>GPS Lines</span><textarea value={gpsImportDraft} onChange={(event) => setGpsImportDraft(event.target.value)} placeholder="GPS:Asteroid Claim:12345.67:-890.12:45678.9:#FF75D69D:" /></label>
            <button type="submit">Import GPS points</button>
          </form>
          <section className="shipOsPanel shipOsPlanetCalibrationPanel">
            <header><span>Planetary Chart Calibration</span><strong>{livePlanetRegistry.length ? `${livePlanetRegistry.length} live${unknownLivePlanetCount ? ` / ${unknownLivePlanetCount} new` : ''}` : calibratedBodyCount ? `${calibratedBodyCount} calibrated` : 'Preset chart'}</strong></header>
            <div className="shipOsPlanetRegistryStatus">
              <span>{livePlanetRegistry.length ? 'Authoritative in-game registry' : 'Awaiting planet-registry telemetry'}</span>
              <strong>{livePlanetRegistry.length ? `${livePlanetRegistry.length} bodies tracked by stable SE identity` : 'Preset coordinates remain active'}</strong>
            </div>
            {livePlanetRegistry.length > 0 && (
              <div className="shipOsPlanetRegistryTable" role="region" aria-label="Live Space Engineers planet registry">
                <table>
                  <thead><tr><th>Chart / SE name</th><th>Center XYZ</th><th>Radius</th><th>Entity ID</th></tr></thead>
                  <tbody>
                    {livePlanetRegistry.map((planet) => {
                      const bodyId = bodyIdFromContactForCalibration(planet)
                      const chartBody = starSystemBodies.find((body) => body.id === bodyId)
                      return (
                        <tr key={planet.id}>
                          <td><strong>{chartBody?.name ?? planet.name}</strong><span>{chartBody && chartBody.name !== planet.name ? planet.name : planet.generatorName || 'New chart body'}</span></td>
                          <td>{formatCoord(planet.x)}:{formatCoord(planet.y)}:{formatCoord(planet.z)}</td>
                          <td>{planet.radiusMeters ? formatKm(planet.radiusMeters) : 'Unknown'}</td>
                          <td>{planet.entityId || 'No stable ID'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={savePlanetaryCalibration}>
              <label><span>Body</span><select value={planetaryCalibrationDraft.bodyId} onChange={(event) => selectPlanetaryCalibrationBody(event.target.value)}>
                {calibratedStarSystemBodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
              </select></label>
              <div className="shipOsCoordInputs">
                <label><span>Center X</span><input value={planetaryCalibrationDraft.x} onChange={(event) => setPlanetaryCalibrationDraft((current) => ({ ...current, x: event.target.value }))} inputMode="decimal" /></label>
                <label><span>Center Y</span><input value={planetaryCalibrationDraft.y} onChange={(event) => setPlanetaryCalibrationDraft((current) => ({ ...current, y: event.target.value }))} inputMode="decimal" /></label>
                <label><span>Center Z</span><input value={planetaryCalibrationDraft.z} onChange={(event) => setPlanetaryCalibrationDraft((current) => ({ ...current, z: event.target.value }))} inputMode="decimal" /></label>
              </div>
              <dl className="shipOsDataList">
                {calibratedStarSystemBodies.map((body) => (
                  <div key={body.id}><dt>{body.name}</dt><dd>{formatCoord(body.x)}:{formatCoord(body.y)}:{formatCoord(body.z)} | {calibrationSummaryForBody(body, planetaryChartOverrides)}</dd></div>
                ))}
              </dl>
              {planetaryCalibrationError && <small className="shipOsTelemetryError">{planetaryCalibrationError}</small>}
              <div className="shipOsActionRow">
                <button type="submit">Save body center</button>
                <button type="button" onClick={resetSelectedPlanetaryCalibration}>Reset body</button>
                <button type="button" onClick={resetAllPlanetaryCalibrations}>Reset all</button>
                <button type="button" disabled={!selectedContact || selectedContact.kind !== 'body'} onClick={loadSelectedBodyIntoCalibration}>Load selected body</button>
              </div>
            </form>
            <form onSubmit={importPlanetaryCalibrationGps}>
              <label><span>Body Center GPS Lines</span><textarea value={planetaryCalibrationDraft.gpsLines} onChange={(event) => setPlanetaryCalibrationDraft((current) => ({ ...current, gpsLines: event.target.value }))} placeholder="GPS:Helena:0:0:0:\nGPS:Ares:1031072:131072:1631072:" /></label>
              <button type="submit">Import body centers</button>
            </form>
          </section>
          <div className="shipOsPanel shipOsImageryPanel">
            <header><span>Contact Imagery</span><strong>{recentContactImages.length} files</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Stored</dt><dd>{formatByteSize(contactImageTotalBytes)}</dd></div>
              <div><dt>Limit</dt><dd>{formatByteSize(contactImageStorageSoftLimit)}</dd></div>
            </dl>
            <div className="shipOsImageGrid">
              {recentContactImages.slice(0, 12).map((image) => (
                <article key={image.id}>
                  <img src={image.dataUrl} alt={image.caption || `${image.contactName} screenshot`} />
                  <span>{new Date(image.createdAt).toLocaleString()} | {formatByteSize(image.byteSize)}</span>
                  <strong>{image.contactName}</strong>
                  {image.caption && <p>{image.caption}</p>}
                  <button type="button" onClick={() => openImageContact(image.contactId)}>Open contact</button>
                </article>
              ))}
              {!recentContactImages.length && (
                <article className="shipOsEmptyState">
                  <strong>No contact images</strong>
                  <span>Sensor archive awaiting imagery.</span>
                </article>
              )}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'captain') {
      return (
        <section className="shipOsCaptainStack" aria-label="Captain command console">
          <details className="shipOsPanel shipOsCaptainDrawer shipOsOfficerBriefing shipOsCaptainBriefing">
            <summary><span>Captain Hales / Command</span><strong>{commandActionCount} action items</strong></summary>
            <div className="shipOsCaptainDrawerBody">
            <dl className="shipOsDataList">
              <div><dt>Ship Time</dt><dd>{currentShipTime}</dd></div>
              <div><dt>Voyage</dt><dd>{currentVoyageLabel}</dd></div>
              <div><dt>Location</dt><dd>{formatCoord(currentPosition.x)}:{formatCoord(currentPosition.y)}:{formatCoord(currentPosition.z)}</dd></div>
              <div><dt>Destination</dt><dd>{plannedDestination.name}</dd></div>
              <div><dt>ETA</dt><dd>{routeEta}</dd></div>
              <div><dt>Current Job</dt><dd>{activeJobs[0]?.title ?? 'No active contract'}</dd></div>
              <div><dt>Operational Status</dt><dd>{telemetryAlerts.length ? `${currentOperationalStatus}; ${telemetryAlerts.length} telemetry alert${telemetryAlerts.length === 1 ? '' : 's'}` : currentOperationalStatus}</dd></div>
              <div><dt>Souls Aboard</dt><dd>{currentSoulsAboard} / {activePersonnel} crew / {activePassengerFiles} passengers</dd></div>
              <div><dt>Operating Bank</dt><dd>{formatCredits(operatingBalance)}</dd></div>
              <div><dt>Crew</dt><dd>{activePersonnel} active / {recruitingPersonnel} pipeline</dd></div>
              <div><dt>Open Commitments</dt><dd>{openCommitments.length}</dd></div>
              <div><dt>Active Incidents</dt><dd>{securityIncidents.length}</dd></div>
              <div><dt>Pending Waves</dt><dd>{awaitingResponses}</dd></div>
            </dl>
            <p>Command sees the shared operational truth: not a separate captain database, but a stitched view over navigation, jobs, comms, finance, people, incidents, ship condition, and promises.</p>
            </div>
          </details>
          <details className="shipOsPanel shipOsCaptainDrawer shipOsOfficerBriefing">
            <summary><span>Command Alerts</span><strong>{commandActionCount} action items</strong></summary>
            <div className="shipOsCaptainDrawerBody">
            <div className="shipOsMemoryList">
              {telemetryAlerts.slice(0, 3).map((alert) => (
                <article key={`${alert.level}-${alert.label}`}>
                  <span>{alert.level}</span>
                  <strong>{alert.label}</strong>
                  <p>{alert.detail}</p>
                </article>
              ))}
              {openSquawks.slice(0, 3).map((squawk) => (
                <article key={squawk.id}>
                  <span>{squawk.state} | {squawk.system}</span>
                  <strong>{squawk.title}</strong>
                  <p>{squawk.condition}</p>
                </article>
              ))}
              {openCommitments.slice(0, 3).map((commitment) => (
                <article key={commitment.id}>
                  <span>{commitment.status} | {commitment.location}</span>
                  <strong>{commitment.person}</strong>
                  <p>{commitment.promise}</p>
                </article>
              ))}
              {!telemetryAlerts.length && !openSquawks.length && !openCommitments.length && !awaitingResponses && (
                <article className="shipOsEmptyState">
                  <strong>No command alerts</strong>
                  <span>Nothing urgent is currently pinned to command.</span>
                </article>
              )}
            </div>
            </div>
          </details>

          <details className="shipOsPanel shipOsCaptainDrawer shipOsAiCommandPanel">
            <summary><span>ABIGAIL Command Intelligence</span><strong>{shipOsAiBusy ? '1 task running' : '0 active tasks'}</strong></summary>
            <form className="shipOsCaptainDrawerBody shipOsAiCommandForm" onSubmit={requestShipOsAiBrief}>
              <div className="shipOsAiCommandControls">
                <label>
                  <span>Decision Model</span>
                  <select value={shipOsAiModelKey || (selectedShipOsAiModel ? `${selectedShipOsAiModel.providerName}|${selectedShipOsAiModel.modelName}` : '')} onChange={(event) => setShipOsAiModelKey(event.target.value)}>
                    {shipOsAiModels.map((model) => <option key={`${model.providerName}|${model.modelName}`} value={`${model.providerName}|${model.modelName}`}>{model.displayName}</option>)}
                  </select>
                </label>
                <div className="shipOsActionRow shipOsAiQuickPrompts">
                  <button type="button" onClick={() => setShipOsAiPrompt('Prepare a concise captain\'s brief. Prioritize immediate hazards, navigation decisions, open commitments, and communications requiring action.')}>Command brief</button>
                  <button type="button" onClick={() => setShipOsAiPrompt('Evaluate the current planetary approach or departure profile. Identify telemetry gaps, unsafe trends, and the next three flight decisions without inventing readings.')}>Flight risk</button>
                  <button type="button" onClick={() => setShipOsAiPrompt('Review the selected EchoMail thread and draft a concise, professional in-universe reply. State any clearance, fee, or authority information that still needs confirmation.')}>Draft reply</button>
                </div>
              </div>
              <label><span>Command Request</span><textarea value={shipOsAiPrompt} onChange={(event) => setShipOsAiPrompt(event.target.value)} /></label>
              <div className="shipOsActionRow">
                <button type="submit" disabled={!isSignedIn || shipOsAiBusy || !shipOsAiPrompt.trim()}>{shipOsAiBusy ? 'Analyzing...' : 'Run command analysis'}</button>
                {shipOsAiReply && <button type="button" onClick={useShipOsAiReplyAsWave}>Use as EchoMail draft</button>}
              </div>
              {shipOsAiError && <p className="shipOsInlineError" role="alert">{shipOsAiError}</p>}
              {shipOsAiReply && <article className="shipOsAiCommandReply"><span>ABIGAIL / {selectedShipOsAiModel?.displayName ?? 'configured model'}</span><p>{shipOsAiReply}</p></article>}
              {!isSignedIn && <p>Sign in to EchoBoard to use the server-side model gateway. Provider credentials remain on the server.</p>}
            </form>
          </details>

          <details className="shipOsPanel shipOsCaptainDrawer shipOsEchoMailSidebar">
            <summary><span>EchoMail</span><strong>{awaitingResponses} action items</strong></summary>
            <div className="shipOsCaptainDrawerBody">
            <div className="shipOsEchoMailFolders" role="list" aria-label="EchoMail folders">
              {echoMailFolders.map((folder) => (
                <button
                  type="button"
                  key={folder.id}
                  className={echoMailFolder === folder.id ? 'active' : ''}
                  aria-pressed={echoMailFolder === folder.id}
                  onClick={() => {
                    setEchoMailFolder(folder.id)
                    setEchoMailPage(0)
                  }}
                >
                  <span>{folder.label}</span>
                  <strong>{echoMailCounts[folder.id] ?? 0}</strong>
                </button>
              ))}
            </div>
            <div className="shipOsRelayList shipOsEchoRelayList">
              {relayNetworks.map((network) => (
                <article key={network}>
                  <span>{network}</span>
                  <strong>{network.includes('OldEarth') || network.includes('Covenant') ? 'Linked' : 'Simulated'}</strong>
                  <p>Round trip response window: 10 minutes outside game time.</p>
                </article>
              ))}
            </div>
            <label className="shipOsCheckRow">
              <input type="checkbox" checked={autoWaveEnabled} onChange={(event) => setAutoWaveEnabled(event.target.checked)} />
              <span>Automatic simulated waves</span>
            </label>
            <div className="shipOsActionRow">
              <button type="button" onClick={generateImmediateWave}>Simulate incoming wave</button>
            </div>
            </div>
          </details>

          <details className="shipOsPanel shipOsCaptainDrawer shipOsEchoMailListPanel">
            <summary><span>EchoMail Threads</span><strong>{awaitingResponses} action items</strong></summary>
            <div className="shipOsCaptainDrawerBody">
            <label className="shipOsEchoMailSearch"><span>Search EchoMail</span><input value={echoMailSearch} onChange={(event) => { setEchoMailSearch(event.target.value); setEchoMailPage(0) }} placeholder="network, subject, crew, clearance, contact" /></label>
            <div className="shipOsEchoMailThreadList">
              {displayedEchoMailThreads.map((thread) => (
                <article
                  key={thread.key}
                  className={`shipOsEchoMailThreadCard${selectedEchoThread?.key === thread.key ? ' active' : ''}`}
                >
                  <button
                    type="button"
                    className="shipOsEchoMailThreadSelect"
                    aria-pressed={selectedEchoThread?.key === thread.key}
                    onClick={() => setSelectedEchoThreadKey(thread.key)}
                  >
                    <span>{thread.latest.network} | {waveChannelLabel(thread.channel)} | {thread.pendingCount ? `${thread.pendingCount} pending` : thread.latest.status}</span>
                    <strong>{baseWaveSubject(thread.latest.subject)}</strong>
                    <p>{thread.latest.from} to {thread.latest.to}: {waveSnippet(thread.latest.body)}</p>
                    <small>{wavePriorityLabel(thread.priority)} | {thread.waves.length} wave{thread.waves.length === 1 ? '' : 's'} | {waveTimeLabel(thread.latest.createdAt)}</small>
                  </button>
                  <button
                    type="button"
                    className="shipOsDangerButton shipOsEchoMailThreadDelete"
                    aria-label={`Delete EchoMail thread ${baseWaveSubject(thread.latest.subject)}`}
                    onClick={() => deleteEchoMailThread(thread)}
                  >
                    Delete
                  </button>
                </article>
              ))}
              {!echoMailThreads.length && (
                <article className="shipOsEmptyState">
                  <strong>No matching waves</strong>
                  <span>{echoMailSearch ? 'Search returned no thread traffic.' : 'Folder is clear.'}</span>
                </article>
              )}
            </div>
            <div className="shipOsActionRow shipOsPagination" aria-label="EchoMail pages">
              <button type="button" disabled={echoMailPage === 0} onClick={() => { setSelectedEchoThreadKey(''); setEchoMailPage((current) => Math.max(0, current - 1)) }}>Previous</button>
              <span>Page {echoMailPage + 1} / {echoMailPageCount}</span>
              <button type="button" disabled={echoMailPage + 1 >= echoMailPageCount} onClick={() => { setSelectedEchoThreadKey(''); setEchoMailPage((current) => Math.min(echoMailPageCount - 1, current + 1)) }}>Next</button>
            </div>
            </div>
          </details>

          <details className="shipOsPanel shipOsCaptainDrawer shipOsEchoMailReader">
            <summary><span>Selected EchoMail</span><strong>{selectedEchoThread?.pendingCount ?? 0} action items</strong></summary>
            <div className="shipOsCaptainDrawerBody">
            {selectedEchoThread ? (
              <>
                <header>
                  <div>
                    <span>{waveChannelLabel(selectedEchoThread.channel)} / {wavePriorityLabel(selectedEchoThread.priority)}</span>
                    <strong>{baseWaveSubject(selectedEchoThread.latest.subject)}</strong>
                  </div>
                  <div className="shipOsEchoMailReaderActions">
                    {pendingEchoWave && <button type="button" onClick={resolveSelectedEchoThreadNow}>Resolve now</button>}
                    <button type="button" className="shipOsDangerButton" onClick={() => deleteEchoMailThread(selectedEchoThread)}>Delete thread</button>
                  </div>
                </header>
                <dl className="shipOsEchoMailMeta">
                  <div><dt>Network</dt><dd>{selectedEchoThread.latest.network}</dd></div>
                  <div><dt>Contact</dt><dd>{selectedEchoThread.contactName ?? 'Ship inbox'}</dd></div>
                  <div><dt>Clearance</dt><dd>{selectedEchoThread.latest.clearanceStatus ?? 'No clearance state'}</dd></div>
                  <div><dt>Fees</dt><dd>{selectedEchoThread.latest.feesCredits ? formatCredits(selectedEchoThread.latest.feesCredits) : 'No fee table'}</dd></div>
                </dl>
                <div className="shipOsEchoMailMessages">
                  {[...selectedEchoThread.waves].reverse().map((wave) => (
                    <article key={wave.id} className={wave.direction}>
                      <span>{waveTimeLabel(wave.createdAt)} | {wave.from} to {wave.to}</span>
                      <strong>{wave.subject}</strong>
                      <p>{wave.body}</p>
                      <small>{wave.network} | {waveChannelLabel(wave.channel)} | {wavePriorityLabel(wave.priority)} | {wave.status === 'awaiting-response' ? `reply in ${minutesUntil(wave.responseDueAt)}` : wave.status}</small>
                      <div className="shipOsActionRow shipOsEchoMailMessageActions">
                        <button type="button" className="shipOsDangerButton" onClick={() => deleteWave(wave)}>Delete wave</button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <article className="shipOsEmptyState">
                <strong>No EchoMail thread selected</strong>
                <span>Inbox idle.</span>
              </article>
            )}
            </div>
          </details>

          <details className="shipOsPanel shipOsCaptainDrawer shipOsWaveForm shipOsEchoMailCompose">
            <summary><span>Compose EchoMail</span><strong>{waveDraftActionCount} draft actions</strong></summary>
            <form className="shipOsCaptainDrawerBody" onSubmit={sendWave}>
            <div className="shipOsCoordInputs">
              <label><span>Relay Network</span><select value={waveDraft.network} onChange={(event) => setWaveDraft((current) => ({ ...current, network: event.target.value }))}>{relayNetworks.map((network) => <option key={network}>{network}</option>)}</select></label>
              <label><span>Channel</span><select value={waveDraft.channel} onChange={(event) => setWaveDraft((current) => ({ ...current, channel: event.target.value as WaveChannel }))}>{waveChannelOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label><span>Priority</span><select value={waveDraft.priority} onChange={(event) => setWaveDraft((current) => ({ ...current, priority: event.target.value as WavePriority }))}>{wavePriorityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            </div>
            <div className="shipOsCoordInputs">
              <label><span>To</span><input value={waveDraft.to} onChange={(event) => setWaveDraft((current) => ({ ...current, to: event.target.value }))} /></label>
              <label><span>Crew copy</span><select value={waveDraft.crewTarget} onChange={(event) => setWaveDraft((current) => ({ ...current, crewTarget: event.target.value }))}><option value="">Ship inbox</option>{crewMembers.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
              <label><span>Linked contact</span><select value={waveDraft.contactId} onChange={(event) => setWaveDraft((current) => ({ ...current, contactId: event.target.value }))}><option value="">None</option>{allContacts.filter(hailableContact).map((contact) => <option key={contact.id} value={contact.id}>{contactFileTitle(contact)} | {contactKindLabel(contact.kind)}</option>)}</select></label>
            </div>
            <label><span>Subject</span><input value={waveDraft.subject} onChange={(event) => setWaveDraft((current) => ({ ...current, subject: event.target.value }))} /></label>
            <label><span>Message</span><textarea value={waveDraft.body} onChange={(event) => setWaveDraft((current) => ({ ...current, body: event.target.value }))} /></label>
            <div className="shipOsActionRow">
              <button type="submit">Send wave</button>
              <button type="button" onClick={() => setWaveDraft(createDefaultWaveDraft())}>Clear draft</button>
            </div>
            </form>
          </details>

          <details className="shipOsPanel shipOsCaptainDrawer shipOsHailTargets">
            <summary><span>Traffic Hails</span><strong>{hailableTargets.length} action items</strong></summary>
            <div className="shipOsCaptainDrawerBody">
            <div className="shipOsHailTargetGrid">
              {hailableTargets.map(({ contact, distance }) => (
                <button type="button" key={contact.id} onClick={() => prepareHailDraft(contact)}>
                  <span>{contactKindLabel(contact.kind)} | {hailRangeState(distance)}</span>
                  <strong>{contactFileTitle(contact)}</strong>
                  <p>{formatKm(distance)} | {contactFactionName(contact) || 'Unassigned / Unknown'}</p>
                </button>
              ))}
            </div>
            </div>
          </details>
        </section>
      )
    }

    if (activeTab === 'navigation') {
      const jumpCount = Math.max(1, Math.ceil(routeDistance / 2000000))
      const reservePercent = Math.max(0, Number(navigationPlan.fuelReserve) || 0)
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel">
            <header><span>Route Planner</span><strong>{plannedDestination.name}</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Distance</dt><dd>{(routeDistance / 1000).toFixed(1)} km</dd></div>
              <div><dt>Jump segments</dt><dd>{jumpCount}</dd></div>
              <div><dt>Cruise ETA</dt><dd>{routeEta}</dd></div>
              <div><dt>Reserve</dt><dd>{reservePercent.toLocaleString()}%</dd></div>
              <div><dt>Target GPS</dt><dd>{formatCoord(plannedDestination.x)}:{formatCoord(plannedDestination.y)}:{formatCoord(plannedDestination.z)}</dd></div>
              <div><dt>Last Speed</dt><dd>{formatMetersPerSecond(lastTelemetryPacket?.speed)}</dd></div>
            </dl>
            <label><span>Destination</span><select value={navigationPlan.destinationId} onChange={(event) => selectNavigationDestinationById(event.target.value)}>
              {allContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} | {contact.className}</option>)}
            </select></label>
            <div className="shipOsCoordInputs">
              <label><span>Cruise m/s</span><input value={navigationPlan.cruiseSpeed} onChange={(event) => setNavigationPlan((current) => ({ ...current, cruiseSpeed: event.target.value }))} inputMode="decimal" /></label>
              <label><span>Fuel reserve %</span><input value={navigationPlan.fuelReserve} onChange={(event) => setNavigationPlan((current) => ({ ...current, fuelReserve: event.target.value }))} inputMode="decimal" /></label>
            </div>
            <label><span>Route Notes</span><textarea value={navigationPlan.notes} onChange={(event) => setNavigationPlan((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="shipOsActionRow">
              <button type="button" disabled={!selectedContact || selectedContact.id === currentShipContactId} onClick={updateCurrentFromContact}>Move Intrepid to selected contact</button>
              {selectedContact && selectedContact.id !== currentShipContactId && <button type="button" onClick={() => setNavigationDestination(selectedContact)}>Project path to selected contact</button>}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Current Position</span><strong>{shipName}</strong></header>
            <div className="shipOsCoordInputs">
              <label><span>X</span><input value={currentPosition.x} onChange={(event) => setCurrentPosition((current) => ({ ...current, x: Number(event.target.value) || 0 }))} inputMode="decimal" /></label>
              <label><span>Y</span><input value={currentPosition.y} onChange={(event) => setCurrentPosition((current) => ({ ...current, y: Number(event.target.value) || 0 }))} inputMode="decimal" /></label>
              <label><span>Z</span><input value={currentPosition.z} onChange={(event) => setCurrentPosition((current) => ({ ...current, z: Number(event.target.value) || 0 }))} inputMode="decimal" /></label>
            </div>
            <p>All sensor contacts are rendered relative to this coordinate.</p>
          </div>
          <div className="shipOsPanel shipOsLocationDatabase">
            <header><span>Universal Location Records</span><strong>{locationRecords.length} IDs</strong></header>
            <div className="shipOsMemoryList">
              {locationRecords.slice(0, 12).map((location) => (
                <article key={location.id} className={location.contactId === selectedContactId ? 'active' : ''}>
                  <span>{location.id} | {location.knowledgeState} | {location.confidence}</span>
                  <strong>{location.name}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>GPS</dt><dd>{formatCoord(location.x)}:{formatCoord(location.y)}:{formatCoord(location.z)}</dd></div>
                    <div><dt>Body</dt><dd>{location.body}</dd></div>
                    <div><dt>Landing</dt><dd>{location.landingSuitability}</dd></div>
                    <div><dt>Visits</dt><dd>{location.previousVisits.length}</dd></div>
                  </dl>
                  <p>{location.whyHere}</p>
                  <small>{location.approachNotes}</small>
                  <button type="button" onClick={() => focusLocationRecord(location)}>Focus location on map</button>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel shipOsFlightPlanPanel">
            <header><span>Flight Operations</span><strong>{flightRoutes.length} plotted</strong></header>
            <div className="shipOsFlightPlanList">
              {flightRoutes.map((flightRoute) => {
                const job = jobRecords.find((item) => item.id === flightRoute.id)
                return (
                  <article key={flightRoute.id} style={{ '--route-color': flightRoute.color } as CSSProperties}>
                    <span>{flightRoute.status} | {flightRoute.passengerCount} manifest file{flightRoute.passengerCount === 1 ? '' : 's'}</span>
                    <strong>{flightRoute.label}</strong>
                    <p>{flightRoute.pointLabels.join(' -> ')}</p>
                    <dl>
                      <div><dt>Distance</dt><dd>{formatKm(flightRoute.distanceMeters)}</dd></div>
                      <div><dt>ETA</dt><dd>{flightRoute.eta}</dd></div>
                      <div><dt>Destination</dt><dd>{flightRoute.destinationName}</dd></div>
                    </dl>
                    {job && (
                      <div className="shipOsActionRow">
                        <button type="button" onClick={() => setJobAsNavigationTarget(job)}>Project job route</button>
                        {job.status !== 'In Transit' && <button type="button" onClick={() => advanceJobStatus(job, 'In Transit')}>Mark in transit</button>}
                      </div>
                    )}
                  </article>
                )
              })}
              {!flightRoutes.length && <article><span>No active routes</span><strong>No plotted flights</strong><p>Booked, boarding, in-transit, or prospect jobs with known destinations appear here.</p></article>}
            </div>
          </div>
          <div className="shipOsPanel shipOsRoutePanel">
            <header><span>Flight Trail</span><strong>{telemetryHistory.length} packets</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Trail Distance</dt><dd>{formatKm(telemetryDistance)}</dd></div>
              <div><dt>Average Speed</dt><dd>{formatMetersPerSecond(averageTelemetrySpeed)}</dd></div>
              <div><dt>Last Packet</dt><dd>{lastTelemetryPacket?.stamp ?? (telemetryHistory[0] ? new Date(telemetryHistory[0].receivedAt).toLocaleString() : 'No packet')}</dd></div>
              <div><dt>Bridge</dt><dd>{bridgeConfig.status}</dd></div>
            </dl>
            <div className="shipOsRouteLegs">
              {telemetryHistory.slice(0, 8).map((sample) => (
                <article key={sample.id}>
                  <span>{sample.importedBy} | {new Date(sample.receivedAt).toLocaleTimeString()}</span>
                  <strong>{coordinateFromTelemetry(sample) ? `${formatCoord(Number(sample.x))}:${formatCoord(Number(sample.y))}:${formatCoord(Number(sample.z))}` : 'No coordinate'}</strong>
                  <p>{formatMetersPerSecond(sample.speed)} | Battery {telemetryPercent(sample.batteryPercent, 0).toFixed(1)}% | H2 {telemetryPercent(sample.hydrogenPercent, 0).toFixed(1)}%</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'chronicle') {
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Ship Chronicle</span><strong>Promises, logs, and remembered history</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Logs</dt><dd>{shipLogs.length}</dd></div>
              <div><dt>Timeline Events</dt><dd>{timelineReplayEvents.length}</dd></div>
              <div><dt>Commitments</dt><dd>{openCommitments.length} open</dd></div>
              <div><dt>Milestones</dt><dd>{chronicleEntries.filter((entry) => entry.status === 'Recorded').length} recorded</dd></div>
              <div><dt>Personal Waves</dt><dd>{waves.filter((wave) => wave.crewTarget).length}</dd></div>
              <div><dt>Latest Event</dt><dd>{timelineReplayEvents[0] ? new Date(timelineReplayEvents[0].stamp).toLocaleString() : 'None'}</dd></div>
            </dl>
            <p>This view keeps Tomas's chronicle, Mother Calen's commitments, personal correspondence, and the replay feed in one historical memory surface.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Personal Waves</span><strong>{waves.filter((wave) => wave.crewTarget).length}</strong></header>
            <div className="shipOsInbox">
              {waves.filter((wave) => wave.crewTarget).map((wave) => (
                <article key={wave.id}>
                  <span>{wave.crewTarget} | {wave.network}</span>
                  <strong>{wave.subject}</strong>
                  <p>{wave.body}</p>
                  <div className="shipOsActionRow">
                    <button type="button" className="shipOsDangerButton" onClick={() => deleteWave(wave)}>Delete wave</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Open Commitments</span><strong>{openCommitments.length} active</strong></header>
            <div className="shipOsMemoryList">
              {commitmentRecords.map((commitment) => (
                <article key={commitment.id} className={commitment.status.toLowerCase()}>
                  <span>{commitment.status} | {commitment.date} | {commitment.location}</span>
                  <strong>{commitment.person}</strong>
                  <p>{commitment.promise}</p>
                  <small>{commitment.timeframe} | {commitment.notes}</small>
                  <div className="shipOsActionRow">
                    {commitment.status === 'Fulfilled'
                      ? <button type="button" onClick={() => setCommitmentStatus(commitment, 'Open')}>Reopen</button>
                      : <button type="button" onClick={() => setCommitmentStatus(commitment, 'Fulfilled')}>Mark fulfilled</button>}
                    {commitment.status !== 'Watching' && commitment.status !== 'Fulfilled' && <button type="button" onClick={() => setCommitmentStatus(commitment, 'Watching')}>Watch</button>}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Ship Chronicle</span><strong>{chronicleEntries.filter((entry) => entry.status === 'Recorded').length} recorded</strong></header>
            <div className="shipOsMemoryList">
              {chronicleEntries.map((entry) => (
                <article key={entry.id} className={entry.status.toLowerCase()}>
                  <span>{entry.status} | {entry.source}</span>
                  <strong>{entry.title}</strong>
                  <p>{entry.notes}</p>
                  <small>{new Date(entry.stamp).toLocaleString()}</small>
                  {entry.status !== 'Recorded' && <button type="button" onClick={() => recordChronicleEntry(entry)}>Record milestone</button>}
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Ship Logs</span><strong>{shipLogs.length}</strong></header>
            <div className="shipOsLogs">
              {shipLogs.map((log) => (
                <article key={log.id}>
                  <span>{new Date(log.stamp).toLocaleString()} | {log.system}</span>
                  <p>{log.entry}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Timeline Replay Feed</span><strong>{timelineReplayEvents.length} events</strong></header>
            <div className="shipOsMemoryList">
              {timelineReplayEvents.slice(0, 18).map((event) => (
                <article key={`${event.source}-${event.id}`}>
                  <span>{new Date(event.stamp).toLocaleString()} | {event.source}</span>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'crew') {
      const flightCrewCount = normalizedCrewMembers.filter((member) => member.department === 'Flight' && !['Applicant', 'Candidate'].includes(member.clearance)).length
      const engineeringCrewCount = normalizedCrewMembers.filter((member) => member.department === 'Engineering' && !['Applicant', 'Candidate'].includes(member.clearance)).length
      const medicalCrewCount = normalizedCrewMembers.filter((member) => member.department === 'Medical' && !['Applicant', 'Candidate'].includes(member.clearance)).length
      const billetRows = [
        { billet: 'Pilot / Flight Officer', department: 'Flight', status: flightCrewCount > 0 ? `${flightCrewCount} assigned` : 'Recruiting', target: 'Kessa Vale primary flight officer', note: 'Flight authority includes stopping unsafe approaches and preserving escape geometry.' },
        { billet: 'Chief Engineer', department: 'Engineering', status: engineeringCrewCount > 0 ? `${engineeringCrewCount} assigned` : 'Recruiting', target: 'Toren Vask CHENG', note: 'Post-refit proving watch is active with no grounding restriction.' },
        { billet: 'Ship Doctor', department: 'Medical', status: medicalCrewCount > 0 ? `${medicalCrewCount} assigned` : 'Candidate review', target: 'Dr. Selene Vard ship doctor', note: 'Medical authority governs patient movement, landing acceptability, and transfer abort decisions.' },
      ]
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsPersonnelCommand">
            <header><span>Naval Personnel System</span><strong>{activePersonnel} active / {recruitingPersonnel} pipeline</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Monthly Payroll</dt><dd>{formatCredits(personnelPayroll)}</dd></div>
              <div><dt>Passenger Cabins</dt><dd>6 occupied</dd></div>
              <div><dt>Total Berths</dt><dd>18 positions</dd></div>
              <div><dt>Authority</dt><dd>Mara Sennett</dd></div>
            </dl>
            <p>Personnel records track billets, clearances, registry standing, medical readiness, quarters, credentials, payroll, and contract status for the Intrepid.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>People / Organizations</span><strong>{directoryEntities.length} entities</strong></header>
            <div className="shipOsMemoryList">
              {directoryEntities.map((entity) => {
                const linkedJob = jobRecords.find((job) => entity.jobIds.includes(job.id))
                const linkedLocation = locationRecords.find((location) => entity.locationIds.includes(location.id) || Boolean(location.contactId && entity.locationIds.includes(location.contactId)))
                return (
                  <article key={entity.id} className={entity.privacy.toLowerCase()}>
                    <span>{entity.kind} | {entity.relationship} | {entity.privacy}</span>
                    <strong>{entity.name}</strong>
                    <dl className="shipOsPersonnelStats">
                      <div><dt>Role</dt><dd>{entity.role}</dd></div>
                      <div><dt>Standing</dt><dd>{entity.standing}</dd></div>
                      <div><dt>Jobs</dt><dd>{entity.jobIds.length}</dd></div>
                      <div><dt>Locations</dt><dd>{entity.locationIds.length}</dd></div>
                    </dl>
                    <p>{entity.notes}</p>
                    {(linkedJob || linkedLocation) && (
                      <div className="shipOsActionRow">
                        {linkedJob && <button type="button" onClick={() => openJobPacket(linkedJob.id)}>Open linked job</button>}
                        {linkedLocation && <button type="button" onClick={() => focusLocationRecord(linkedLocation)}>Focus linked location</button>}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
          <div className="shipOsPanel shipOsWatchPanel">
            <header><span>Watch Rotation</span><strong>{crewByShift.length} watches</strong></header>
            <div className="shipOsWatchGrid">
              {crewByShift.map(([shift, members]) => (
                <article key={shift}>
                  <span>{shift}</span>
                  <strong>{members.length} assigned</strong>
                  <p>{members.map((member) => member.name).join(' | ')}</p>
                </article>
              ))}
            </div>
            <button type="button" onClick={postPayrollRun}>Post monthly payroll</button>
          </div>
          <div className="shipOsPanel shipOsReadinessPanel">
            <header><span>Department Readiness</span><strong>{departmentReadiness.length} departments</strong></header>
            <div className="shipOsReadinessGrid">
              {departmentReadiness.map(([department, members]) => {
                const medicallyReady = members.filter((member) => !member.medicalStatus?.toLowerCase().includes('needed')).length
                return (
                  <article key={department}>
                    <span>{department}</span>
                    <strong>{members.length} personnel</strong>
                    <dl className="shipOsPersonnelStats">
                      <div><dt>Medical Ready</dt><dd>{medicallyReady} / {members.length}</dd></div>
                      <div><dt>Payroll</dt><dd>{formatCredits(members.reduce((total, member) => total + (member.rateMonthly || 0), 0))} / mo</dd></div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Personnel Records</span><strong>{normalizedCrewMembers.length}</strong></header>
            <div className="shipOsRoster">
              {normalizedCrewMembers.map((member) => (
                <article key={member.id} className={member.id === editingCrewId ? 'active' : ''}>
                  <button
                    type="button"
                    className="shipOsRecordIntro shipOsPersonnelFileTrigger"
                    onClick={() => startEditingCrewMember(member)}
                    aria-label={`Open editable personnel file for ${member.name}`}
                  >
                    <PortraitTile portraitId={member.portraitId} customPortraits={generatedPortraits} />
                    <div>
                      <span>{member.serviceNumber} | {member.department}</span>
                      <strong>{member.name}</strong>
                    </div>
                  </button>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Billet</dt><dd>{member.billet}</dd></div>
                    <div><dt>Shift</dt><dd>{member.shift}</dd></div>
                    <div><dt>Rate</dt><dd>{formatCredits(member.rateMonthly || 0)} / mo</dd></div>
                    <div><dt>Standing</dt><dd>{member.registryStanding}</dd></div>
                    <div><dt>Quarters</dt><dd>{member.quarters}</dd></div>
                    <div><dt>Medical</dt><dd>{member.medicalStatus}</dd></div>
                  </dl>
                  <p>{member.role} - {member.status}</p>
                  <small>{member.contractStatus} | {member.credentials?.join(' | ')}</small>
                  {member.notes && <p>{member.notes}</p>}
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => startEditingCrewMember(member)}>{member.id === editingCrewId ? 'File open' : 'Open file'}</button>
                    {member.id !== 'crew-hales' && <button type="button" onClick={() => removeCrewMember(member)}>Remove record</button>}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <form className="shipOsPanel shipOsPersonnelForm" onSubmit={addCrewMember}>
            <header><span>New Hire Intake</span><strong>Personnel File</strong></header>
            <PortraitSelector value={crewDraft.portraitId} customPortraits={generatedPortraits} onChange={(portraitId) => setCrewDraft((current) => ({ ...current, portraitId }))} />
            <label><span>Name</span><input value={crewDraft.name} onChange={(event) => setCrewDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Role</span><input value={crewDraft.role} onChange={(event) => setCrewDraft((current) => ({ ...current, role: event.target.value }))} /></label>
            <div className="shipOsCoordInputs">
              <label><span>Department</span><input value={crewDraft.department} onChange={(event) => setCrewDraft((current) => ({ ...current, department: event.target.value }))} /></label>
              <label><span>Service No.</span><input value={crewDraft.serviceNumber} onChange={(event) => setCrewDraft((current) => ({ ...current, serviceNumber: event.target.value }))} placeholder="Auto if blank" /></label>
              <label><span>Monthly Rate</span><input value={crewDraft.rateMonthly} onChange={(event) => setCrewDraft((current) => ({ ...current, rateMonthly: event.target.value }))} inputMode="numeric" /></label>
            </div>
            <label><span>Billet</span><input value={crewDraft.billet} onChange={(event) => setCrewDraft((current) => ({ ...current, billet: event.target.value }))} /></label>
            <label><span>Contract</span><input value={crewDraft.contractStatus} onChange={(event) => setCrewDraft((current) => ({ ...current, contractStatus: event.target.value }))} /></label>
            <div className="shipOsCoordInputs">
              <label><span>Registry</span><input value={crewDraft.registryStanding} onChange={(event) => setCrewDraft((current) => ({ ...current, registryStanding: event.target.value }))} /></label>
              <label><span>Quarters</span><input value={crewDraft.quarters} onChange={(event) => setCrewDraft((current) => ({ ...current, quarters: event.target.value }))} /></label>
              <label><span>Medical</span><input value={crewDraft.medicalStatus} onChange={(event) => setCrewDraft((current) => ({ ...current, medicalStatus: event.target.value }))} /></label>
            </div>
            <label><span>Shift</span><input value={crewDraft.shift} onChange={(event) => setCrewDraft((current) => ({ ...current, shift: event.target.value }))} /></label>
            <label><span>Status</span><input value={crewDraft.status} onChange={(event) => setCrewDraft((current) => ({ ...current, status: event.target.value }))} /></label>
            <label><span>Clearance</span><input value={crewDraft.clearance} onChange={(event) => setCrewDraft((current) => ({ ...current, clearance: event.target.value }))} /></label>
            <label><span>Credentials</span><input value={crewDraft.credentials} onChange={(event) => setCrewDraft((current) => ({ ...current, credentials: event.target.value }))} /></label>
            <label><span>Notes</span><textarea value={crewDraft.notes} onChange={(event) => setCrewDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit">Create personnel record</button>
          </form>
          <div className="shipOsPanel">
            <header><span>Billet Watch</span><strong>Recruiting</strong></header>
            <div className="shipOsBilletBoard">
              {billetRows.map((row) => (
                <article key={row.billet}>
                  <span>{row.department}</span>
                  <strong>{row.billet}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Status</dt><dd>{row.status}</dd></div>
                    <div><dt>Target</dt><dd>{row.target}</dd></div>
                  </dl>
                  <p>{row.note}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Venture Profile</span><strong>5M operating account</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Captain</dt><dd>{captainName}</dd></div>
              <div><dt>First Officer</dt><dd>Mara Sennett</dd></div>
              <div><dt>Cabins</dt><dd>6 passenger / 18 total berths</dd></div>
              <div><dt>Last Port</dt><dd>Ares / Meridian Naval Works</dd></div>
              <div><dt>Current Leg</dt><dd>{currentVoyageLabel}</dd></div>
              <div><dt>Souls Aboard</dt><dd>{currentSoulsAboard}: 8 crew / 7 passengers</dd></div>
            </dl>
            <p>Mara has commercial authority, passenger manifests, procurement, payroll, routine negotiation, and the standing order to challenge bad ideas before they become expensive or dangerous.</p>
          </div>
        </section>
      )
    }

    if (activeTab === 'firstOfficer') {
      const firstOfficerBilletRows = [
        { billet: 'Pilot / Flight Officer', department: 'Flight', status: normalizedCrewMembers.some((member) => member.department === 'Flight' && !['Applicant', 'Candidate'].includes(member.clearance)) ? 'Assigned' : 'Recruiting', target: 'Kessa Vale primary flight officer' },
        { billet: 'Chief Engineer', department: 'Engineering', status: normalizedCrewMembers.some((member) => member.department === 'Engineering' && !['Applicant', 'Candidate'].includes(member.clearance)) ? 'Assigned' : 'Recruiting', target: 'Toren Vask CHENG' },
        { billet: 'Ship Doctor', department: 'Medical', status: normalizedCrewMembers.some((member) => member.department === 'Medical' && !['Applicant', 'Candidate'].includes(member.clearance)) ? 'Assigned' : 'Candidate review', target: 'Dr. Selene Vard ship doctor' },
      ]

      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Mara Sennett / First Officer</span><strong>Operations and commercial control</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Active Jobs</dt><dd>{activeJobs.length}</dd></div>
              <div><dt>Active Passengers</dt><dd>{activePassengerFiles}</dd></div>
              <div><dt>Flagged Files</dt><dd>{flaggedPassengerFiles}</dd></div>
              <div><dt>Payroll Burn</dt><dd>{formatCredits(personnelPayroll)} / mo</dd></div>
              <div><dt>Operating Bank</dt><dd>{formatCredits(operatingBalance)}</dd></div>
              <div><dt>Recurring Burn</dt><dd>{formatCredits(recurringMonthlyBurn)} / mo</dd></div>
            </dl>
            <p>Mara's workstation links contracts, manifests, crew administration, payroll, docking, invoices, and profitability without creating separate truths for jobs, people, or money.</p>
          </div>
          <div className="shipOsPanel shipOsPersonnelCommand">
            <header><span>Naval Personnel System</span><strong>{activePersonnel} active / {recruitingPersonnel} pipeline</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Monthly Payroll</dt><dd>{formatCredits(personnelPayroll)}</dd></div>
              <div><dt>Passenger Cabins</dt><dd>6 occupied</dd></div>
              <div><dt>Total Berths</dt><dd>18 positions</dd></div>
              <div><dt>Authority</dt><dd>Mara Sennett</dd></div>
            </dl>
            <p>Personnel records track billets, clearances, registry standing, medical readiness, quarters, credentials, payroll, and contract status for the Intrepid.</p>
          </div>
          <div className="shipOsPanel shipOsBankCommand">
            <header><span>Operating Bank</span><strong>{formatCredits(operatingBalance)}</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Month Income</dt><dd>{formatCredits(bankMonthIncome)}</dd></div>
              <div><dt>Month Expenses</dt><dd>{formatCredits(bankMonthExpenses)}</dd></div>
              <div><dt>Net This Month</dt><dd>{formatCredits(bankMonthIncome - bankMonthExpenses)}</dd></div>
              <div><dt>Recurring Burn</dt><dd>{formatCredits(recurringMonthlyBurn)} / mo</dd></div>
            </dl>
            <label><span>Ledger Month</span><input type="month" value={bankMonth} onChange={(event) => setBankMonth(event.target.value || currentMonthKey())} /></label>
            <p>Tracks venture cash, payroll, docking costs, passenger income, cargo revenue, refits, invoices, and recurring obligations.</p>
          </div>
          <div className="shipOsPanel shipOsWatchPanel">
            <header><span>Watch Rotation</span><strong>{crewByShift.length} watches</strong></header>
            <div className="shipOsWatchGrid">
              {crewByShift.map(([shift, members]) => (
                <article key={shift}>
                  <span>{shift}</span>
                  <strong>{members.length} assigned</strong>
                  <p>{members.map((member) => member.name).join(' | ')}</p>
                </article>
              ))}
            </div>
            <button type="button" onClick={postPayrollRun}>Post monthly payroll</button>
          </div>
          <div className="shipOsPanel shipOsReadinessPanel">
            <header><span>Department Readiness</span><strong>{departmentReadiness.length} departments</strong></header>
            <div className="shipOsReadinessGrid">
              {departmentReadiness.map(([department, members]) => {
                const medicallyReady = members.filter((member) => !member.medicalStatus?.toLowerCase().includes('needed')).length
                return (
                  <article key={department}>
                    <span>{department}</span>
                    <strong>{members.length} personnel</strong>
                    <dl className="shipOsPersonnelStats">
                      <div><dt>Medical Ready</dt><dd>{medicallyReady} / {members.length}</dd></div>
                      <div><dt>Payroll</dt><dd>{formatCredits(members.reduce((total, member) => total + (member.rateMonthly || 0), 0))} / mo</dd></div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Personnel Records</span><strong>{normalizedCrewMembers.length}</strong></header>
            <div className="shipOsRoster">
              {normalizedCrewMembers.map((member) => (
                <article key={member.id} className={member.id === editingCrewId ? 'active' : ''}>
                  <button
                    type="button"
                    className="shipOsRecordIntro shipOsPersonnelFileTrigger"
                    onClick={() => startEditingCrewMember(member)}
                    aria-label={`Open editable personnel file for ${member.name}`}
                  >
                    <PortraitTile portraitId={member.portraitId} customPortraits={generatedPortraits} />
                    <div>
                      <span>{member.serviceNumber} | {member.department}</span>
                      <strong>{member.name}</strong>
                    </div>
                  </button>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Billet</dt><dd>{member.billet}</dd></div>
                    <div><dt>Shift</dt><dd>{member.shift}</dd></div>
                    <div><dt>Rate</dt><dd>{formatCredits(member.rateMonthly || 0)} / mo</dd></div>
                    <div><dt>Standing</dt><dd>{member.registryStanding}</dd></div>
                    <div><dt>Medical</dt><dd>{member.medicalStatus}</dd></div>
                  </dl>
                  <p>{member.role} - {member.status}</p>
                  <small>{member.contractStatus} | {member.credentials?.join(' | ')}</small>
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => startEditingCrewMember(member)}>{member.id === editingCrewId ? 'File open' : 'Open file'}</button>
                    {member.id !== 'crew-hales' && <button type="button" onClick={() => removeCrewMember(member)}>Remove record</button>}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <form className="shipOsPanel shipOsPersonnelForm" onSubmit={addCrewMember}>
            <header><span>New Hire Intake</span><strong>Personnel File</strong></header>
            <PortraitSelector value={crewDraft.portraitId} customPortraits={generatedPortraits} onChange={(portraitId) => setCrewDraft((current) => ({ ...current, portraitId }))} />
            <label><span>Name</span><input value={crewDraft.name} onChange={(event) => setCrewDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Role</span><input value={crewDraft.role} onChange={(event) => setCrewDraft((current) => ({ ...current, role: event.target.value }))} /></label>
            <div className="shipOsCoordInputs">
              <label><span>Department</span><input value={crewDraft.department} onChange={(event) => setCrewDraft((current) => ({ ...current, department: event.target.value }))} /></label>
              <label><span>Service No.</span><input value={crewDraft.serviceNumber} onChange={(event) => setCrewDraft((current) => ({ ...current, serviceNumber: event.target.value }))} placeholder="Auto if blank" /></label>
              <label><span>Monthly Rate</span><input value={crewDraft.rateMonthly} onChange={(event) => setCrewDraft((current) => ({ ...current, rateMonthly: event.target.value }))} inputMode="numeric" /></label>
            </div>
            <label><span>Billet</span><input value={crewDraft.billet} onChange={(event) => setCrewDraft((current) => ({ ...current, billet: event.target.value }))} /></label>
            <label><span>Contract</span><input value={crewDraft.contractStatus} onChange={(event) => setCrewDraft((current) => ({ ...current, contractStatus: event.target.value }))} /></label>
            <div className="shipOsCoordInputs">
              <label><span>Registry</span><input value={crewDraft.registryStanding} onChange={(event) => setCrewDraft((current) => ({ ...current, registryStanding: event.target.value }))} /></label>
              <label><span>Quarters</span><input value={crewDraft.quarters} onChange={(event) => setCrewDraft((current) => ({ ...current, quarters: event.target.value }))} /></label>
              <label><span>Medical</span><input value={crewDraft.medicalStatus} onChange={(event) => setCrewDraft((current) => ({ ...current, medicalStatus: event.target.value }))} /></label>
            </div>
            <label><span>Shift</span><input value={crewDraft.shift} onChange={(event) => setCrewDraft((current) => ({ ...current, shift: event.target.value }))} /></label>
            <label><span>Status</span><input value={crewDraft.status} onChange={(event) => setCrewDraft((current) => ({ ...current, status: event.target.value }))} /></label>
            <label><span>Clearance</span><input value={crewDraft.clearance} onChange={(event) => setCrewDraft((current) => ({ ...current, clearance: event.target.value }))} /></label>
            <label><span>Credentials</span><input value={crewDraft.credentials} onChange={(event) => setCrewDraft((current) => ({ ...current, credentials: event.target.value }))} /></label>
            <label><span>Notes</span><textarea value={crewDraft.notes} onChange={(event) => setCrewDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit">Create personnel record</button>
          </form>
          <div className="shipOsPanel">
            <header><span>Billet Watch</span><strong>Recruiting</strong></header>
            <div className="shipOsBilletBoard">
              {firstOfficerBilletRows.map((row) => (
                <article key={row.billet}>
                  <span>{row.department}</span>
                  <strong>{row.billet}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Status</dt><dd>{row.status}</dd></div>
                    <div><dt>Target</dt><dd>{row.target}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Monthly Ledger</span><strong>{bankMonthEntries.length} entries</strong></header>
            <div className="shipOsBankLedger">
              {bankMonthEntries.length === 0 ? (
                <article>
                  <span>No entries</span>
                  <strong>{bankMonth}</strong>
                  <p>No income or expense records logged for this month.</p>
                </article>
              ) : bankMonthEntries.map((entry) => (
                <article key={entry.id} className={entry.kind}>
                  <span>{entry.date} | {entry.category} | {entry.recurring ? 'Recurring' : 'One-time'}</span>
                  <strong>{entry.vendor}</strong>
                  <p>{entry.kind === 'income' ? '+' : '-'}{formatCredits(entry.amount)} {entry.notes && `| ${entry.notes}`}</p>
                  <button type="button" onClick={() => setBankEntries((current) => current.filter((item) => item.id !== entry.id))}>Delete entry</button>
                </article>
              ))}
            </div>
          </div>
          <form className="shipOsPanel shipOsBankForm" onSubmit={addBankEntry}>
            <header><span>Post Transaction</span><strong>Ledger</strong></header>
            <div className="shipOsCoordInputs">
              <label><span>Date</span><input type="date" value={bankDraft.date} onChange={(event) => setBankDraft((current) => ({ ...current, date: event.target.value }))} /></label>
              <label><span>Type</span><select value={bankDraft.kind} onChange={(event) => setBankDraft((current) => ({ ...current, kind: event.target.value as BankEntry['kind'] }))}><option value="expense">Expense</option><option value="income">Income</option></select></label>
              <label><span>Amount</span><input value={bankDraft.amount} onChange={(event) => setBankDraft((current) => ({ ...current, amount: event.target.value }))} inputMode="decimal" /></label>
            </div>
            <label><span>Vendor / Account</span><input value={bankDraft.vendor} onChange={(event) => setBankDraft((current) => ({ ...current, vendor: event.target.value }))} /></label>
            <label><span>Category</span><input value={bankDraft.category} onChange={(event) => setBankDraft((current) => ({ ...current, category: event.target.value }))} /></label>
            <label className="shipOsCheckRow"><input type="checkbox" checked={bankDraft.recurring} onChange={(event) => setBankDraft((current) => ({ ...current, recurring: event.target.checked }))} /><span>Recurring monthly obligation</span></label>
            <label><span>Notes</span><textarea value={bankDraft.notes} onChange={(event) => setBankDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit">Post transaction</button>
          </form>
          <div className="shipOsPanel shipOsJobsCommand">
            <header><span>Operations Board</span><strong>{jobRecords.length} packets / {passengerFiles.length} files</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Selected Job</dt><dd>{selectedJob?.title ?? 'No job selected'}</dd></div>
              <div><dt>Active Passengers</dt><dd>{activePassengerFiles}</dd></div>
              <div><dt>Flagged Files</dt><dd>{flaggedPassengerFiles}</dd></div>
              <div><dt>Manifest Revenue</dt><dd>{formatCredits(passengerRevenue)}</dd></div>
              <div><dt>Active Jobs</dt><dd>{activeJobs.length}</dd></div>
              <div><dt>Nav Target</dt><dd>{plannedDestination.name}</dd></div>
            </dl>
            <p>Passenger files are grouped by job packet. Use Append Passenger to add a new file directly to a job, or edit a file to move it between jobs.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Relational Contract Map</span><strong>{jobRelationshipRows.length} jobs</strong></header>
            <div className="shipOsMemoryList">
              {jobRelationshipRows.filter(({ job }) => job.id !== holdingJobId).map(({ job, locationIds, entityIds, transactionCount, communicationCount }) => {
                const locationNames = locationRecords.filter((location) => locationIds.includes(location.id)).map((location) => location.name)
                const entityNames = directoryEntities.filter((entity) => entityIds.includes(entity.id)).map((entity) => entity.name)
                const linkedLocation = locationRecords.find((location) => locationIds.includes(location.id))
                return (
                  <article key={job.id} className={job.id === selectedJobId ? 'active' : ''}>
                    <span>{job.status} | {job.client}</span>
                    <strong>{job.title}</strong>
                    <dl className="shipOsPersonnelStats">
                      <div><dt>Locations</dt><dd>{locationNames.slice(0, 3).join(' | ') || 'Unlinked'}</dd></div>
                      <div><dt>Entities</dt><dd>{entityNames.slice(0, 3).join(' | ') || 'Unlinked'}</dd></div>
                      <div><dt>Transactions</dt><dd>{transactionCount}</dd></div>
                      <div><dt>Comms</dt><dd>{communicationCount}</dd></div>
                    </dl>
                    <p>{job.notes}</p>
                    <div className="shipOsActionRow">
                      <button type="button" aria-pressed={job.id === selectedJobId} onClick={() => setSelectedJobId(job.id)}>{job.id === selectedJobId ? 'Selected job' : 'Select job'}</button>
                      <button type="button" onClick={() => setJobAsNavigationTarget(job)}>Project route</button>
                      {linkedLocation && <button type="button" onClick={() => focusLocationRecord(linkedLocation)}>Focus first location</button>}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="shipOsPanel shipOsJobsOpsPanel">
            <header><span>Mission Ops Board</span><strong>{activeJobs.length} active</strong></header>
            <div className="shipOsMissionRows">
              {jobOpsRows.filter(({ job }) => job.id !== holdingJobId).slice(0, 8).map(({ job, passengers, fareTotal, destinationContact }) => (
                <article key={job.id}>
                  <span>{job.status} | {destinationContact ? `Nav: ${destinationContact.name}` : 'GPS pending'}</span>
                  <strong>{job.title}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Passengers</dt><dd>{passengers.length}</dd></div>
                    <div><dt>Total Value</dt><dd>{formatCredits(job.payout + fareTotal)}</dd></div>
                  </dl>
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => setJobAsNavigationTarget(job)}>Project job route</button>
                    <button type="button" onClick={() => sendJobOpsWave(job)}>Send ops wave</button>
                    <button type="button" onClick={() => advanceJobStatus(job, job.status === 'Boarding' ? 'In Transit' : job.status === 'In Transit' ? 'Complete' : 'Boarding')}>Advance status</button>
                    <button type="button" onClick={() => settleJobToBank(job)}>Settle to bank</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="shipOsPanel">
            <header><span>Job Directory</span><strong>{sortedJobRecords.length}</strong></header>
            <div className="shipOsJobDirectory">
              {sortedJobRecords.map((job) => {
                const files = passengerFiles.filter((file) => file.jobId === job.id)
                const jobRevenue = files.reduce((total, file) => total + file.fare, 0)
                return (
                  <article key={job.id} className={job.id === selectedJobId ? 'active' : ''}>
                    <span>{job.status} | due {job.due || 'TBD'}</span>
                    <strong>{job.title}</strong>
                    <dl className="shipOsPersonnelStats">
                      <div><dt>Client</dt><dd>{job.client}</dd></div>
                      <div><dt>Pax Files</dt><dd>{files.length}</dd></div>
                      <div><dt>Payout</dt><dd>{formatCredits(job.payout)}</dd></div>
                      <div><dt>Fare Ledger</dt><dd>{formatCredits(jobRevenue)}</dd></div>
                    </dl>
                    <p>{job.route} | {job.destination}</p>
                    {job.notes && <small>{job.notes}</small>}
                    <div className="shipOsActionRow">
                      <button type="button" aria-pressed={job.id === selectedJobId} onClick={() => setSelectedJobId(job.id)}>{job.id === selectedJobId ? 'Selected job' : 'Select job'}</button>
                      <button type="button" onClick={() => appendPassengerToJob(job)}>Append passenger</button>
                      <button type="button" onClick={() => startEditingJob(job)}>Edit job</button>
                      {job.id !== holdingJobId && <button type="button" onClick={() => deleteJobRecord(job)}>Delete job</button>}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="shipOsJobTools">
            {renderJobForm(jobDraft, setJobDraft, addJobRecord, 'Create Job Packet', 'Contract', 'Create job')}
            {editingJob && renderJobForm(jobEditDraft, setJobEditDraft, saveJobRecord, 'Edit Job Packet', editingJob.title, 'Save job', cancelEditingJob)}
            {renderPassengerForm(passengerDraft, setPassengerDraft, addPassengerFile, 'Append Passenger File', selectedJob?.title ?? 'Manifest', 'Create passenger file')}
          </div>

          <div className="shipOsPanel shipOsPassengerManifest">
            <header><span>Passenger Files By Job</span><strong>{passengerFiles.length}</strong></header>
            <div className="shipOsPassengerGroups">
              {sortedJobRecords.map((job) => {
                const files = passengerFiles
                  .filter((file) => file.jobId === job.id)
                  .sort((left, right) => left.name.localeCompare(right.name) || left.manifestId.localeCompare(right.manifestId))
                return (
                  <section className="shipOsPassengerGroup" key={job.id}>
                    <header>
                      <span>{job.status}</span>
                      <strong>{job.title}</strong>
                      <small>{files.length} passenger file{files.length === 1 ? '' : 's'}</small>
                    </header>
                    {files.length === 0 ? (
                      <p>No passenger files assigned to this job.</p>
                    ) : (
                      <div className="shipOsPassengerCards">
                        {files.map((file) => (
                          <article key={file.id} className={file.id === editingPassengerId ? 'active' : ''}>
                            <button
                              type="button"
                              className="shipOsRecordIntro shipOsPersonnelFileTrigger"
                              onClick={() => startEditingPassengerFile(file)}
                              aria-label={`Open editable passenger file for ${file.name}`}
                            >
                              <PortraitTile portraitId={passengerPortraitId(file)} customPortraits={generatedPortraits} />
                              <div>
                                <span>{file.manifestId} | {file.status} | {file.risk}</span>
                                <strong>{file.name}</strong>
                              </div>
                            </button>
                            <dl className="shipOsPersonnelStats">
                              <div><dt>Route</dt><dd>{file.origin} to {file.destination}</dd></div>
                              <div><dt>Cabin</dt><dd>{file.cabin}</dd></div>
                              <div><dt>Fare</dt><dd>{formatCredits(file.fare)}</dd></div>
                              <div><dt>Baggage</dt><dd>{file.baggageKg.toLocaleString()} kg</dd></div>
                              <div><dt>Clearance</dt><dd>{file.clearance}</dd></div>
                              <div><dt>Medical</dt><dd>{file.medical}</dd></div>
                            </dl>
                            <p>{file.contact}</p>
                            {file.notes && <small>{file.notes}</small>}
                            <div className="shipOsActionRow">
                              <button type="button" onClick={() => startEditingPassengerFile(file)}>{file.id === editingPassengerId ? 'Editing file' : 'Edit file'}</button>
                              <button type="button" onClick={() => deletePassengerFile(file)}>Delete file</button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'medical') {
      const medicalJobRows = jobOpsRows.filter(({ job }) => /medical|clinic|patient|trauma|hospital/i.test(`${job.title} ${job.client} ${job.notes}`))
      const medicalPassengerRows = passengerFiles.filter((file) => file.medical && !/no flag|no personal flag/i.test(file.medical))
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Dr. Selene Vard / Medical</span><strong>Facility capability directory</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Known Facilities</dt><dd>{medicalFacilities.length}</dd></div>
              <div><dt>Medical Jobs</dt><dd>{medicalJobRows.length}</dd></div>
              <div><dt>Flagged Pax</dt><dd>{medicalPassengerRows.length}</dd></div>
              <div><dt>Current Destination</dt><dd>{plannedDestination.name}</dd></div>
              <div><dt>ETA</dt><dd>{routeEta}</dd></div>
              <div><dt>Authority</dt><dd>Medical may abort unsafe transfer</dd></div>
            </dl>
            <p>Medical starts as a facility-capability directory, not a shipwide patient chart. Sensitive patient data stays summarized unless a later permission layer exposes it.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Where Can I Take This Person?</span><strong>{medicalFacilities.length} options</strong></header>
            <div className="shipOsMemoryList">
              {medicalFacilities.map((facility) => {
                const location = locationRecords.find((record) => record.id === facility.locationId || record.contactId === facility.locationId)
                return (
                  <article key={facility.id}>
                    <span>{facility.access}</span>
                    <strong>{facility.name}</strong>
                    <p>{facility.capabilities.join(' | ')}</p>
                    <small>{location?.name ?? facility.locationId} | {facility.travelNote} | {facility.notes}</small>
                    <div className="shipOsActionRow">
                      <button type="button" onClick={() => focusLocationById(facility.locationId)}>Focus facility location</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Medical Movement Board</span><strong>{medicalJobRows.length} jobs</strong></header>
            <div className="shipOsMissionRows">
              {medicalJobRows.map(({ job, passengers, fareTotal, destinationContact }) => (
                <article key={job.id}>
                  <span>{job.status} | {destinationContact ? `Nav: ${destinationContact.name}` : 'GPS pending'}</span>
                  <strong>{job.title}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Passengers</dt><dd>{passengers.length}</dd></div>
                    <div><dt>Value</dt><dd>{formatCredits(job.payout + fareTotal)}</dd></div>
                  </dl>
                  <p>{job.notes}</p>
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => setJobAsNavigationTarget(job)}>Project medical route</button>
                    <button type="button" onClick={() => openJobPacket(job.id)}>Open ops packet</button>
                  </div>
                </article>
              ))}
              {!medicalJobRows.length && <article><span>Clear</span><strong>No medical jobs found</strong><p>Jobs with medical, clinic, patient, trauma, or hospital language will appear here.</p></article>}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Medical Flags</span><strong>{medicalPassengerRows.length}</strong></header>
            <div className="shipOsPassengerCards">
              {medicalPassengerRows.map((file) => (
                <article key={file.id}>
                  <button
                    type="button"
                    className="shipOsRecordIntro shipOsPersonnelFileTrigger"
                    onClick={() => startEditingPassengerFile(file)}
                    aria-label={`Open editable passenger file for ${file.name}`}
                  >
                    <PortraitTile portraitId={passengerPortraitId(file)} customPortraits={generatedPortraits} />
                    <div>
                      <span>{file.manifestId} | {file.status}</span>
                      <strong>{file.name}</strong>
                    </div>
                  </button>
                  <p>{file.medical}</p>
                  <small>{file.origin} to {file.destination} | {file.cabin}</small>
                </article>
              ))}
              {!medicalPassengerRows.length && <article className="shipOsEmptyState"><strong>No passenger medical flags</strong><span>Passenger manifest currently exposes no special medical handling notes.</span></article>}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'security') {
      const threatContacts = nearbyContacts.filter(({ contact }) => isHostileContact(contact) || contactIffFilterId(contact) === 'unknown').slice(0, 12)
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Garran Vex / Security</span><strong>Incidents separate from places</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Incidents</dt><dd>{securityIncidents.length}</dd></div>
              <div><dt>Threat Contacts</dt><dd>{threatContacts.length}</dd></div>
              <div><dt>Flagged Pax</dt><dd>{flaggedPassengerFiles}</dd></div>
              <div><dt>Defense Envelopes</dt><dd>{allContacts.filter((contact) => contact.id !== currentShipContactId && contactDefenseEnvelope(contact)).length + 1}</dd></div>
              <div><dt>Open Squawks</dt><dd>{openSquawks.filter((squawk) => /security|damage|weapon|boarding|muster/i.test(`${squawk.system} ${squawk.title}`)).length}</dd></div>
              <div><dt>Permission</dt><dd>Threat intel is not passenger-facing</dd></div>
            </dl>
            <p>Security records events, evidence, confidence, involved people, and outcomes without permanently branding every nearby location as hostile.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Emergency Muster</span><strong>Log action</strong></header>
            <div className="shipOsActionRow shipOsEmergencyActions">
              {['GENERAL QUARTERS', 'MEDICAL EMERGENCY', 'BOARDING', 'FIRE', 'ATMOSPHERE LOSS', 'ABANDON SHIP'].map((action) => (
                <button type="button" key={action} onClick={() => appendLog('SECURITY', `${action} drill/action logged from Garran Vex security workstation.`)}>{action}</button>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Incident Intelligence</span><strong>{securityIncidents.length}</strong></header>
            <div className="shipOsMemoryList">
              {securityIncidents.map((incident) => {
                const location = locationRecords.find((record) => record.id === incident.locationId)
                return (
                  <article key={incident.id} className={incident.permission.toLowerCase()}>
                    <span>{incident.confidence} | {incident.permission}</span>
                    <strong>{incident.title}</strong>
                    <p>{incident.outcome}. {incident.notes}</p>
                    <small>{location?.name ?? incident.locationId} | {incident.involved.join(' | ')}</small>
                    <div className="shipOsActionRow">
                      <button type="button" onClick={() => focusLocationById(incident.locationId)}>Focus incident location</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Threat / Unknown Contacts</span><strong>{threatContacts.length}</strong></header>
            <div className="shipOsContactList">
              {threatContacts.map(({ contact, distance }) => (
                <button type="button" key={contact.id} className={contact.id === selectedContactId ? 'active' : ''} aria-pressed={contact.id === selectedContactId} onClick={() => handleSelectContact(contact.id)}>
                  <span>{contactDispositionLabel(contactIffFilterId(contact))} | {contactKindLabel(contact.kind)} | {contactFactionName(contact) || 'Unassigned'}</span>
                  <strong>{mapLabelForContact(contact)}</strong>
                  <small>{formatKm(distance)} | {contact.status}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'steward') {
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Luca Bern / Stewardship</span><strong>Stores, cargo, and passenger endurance</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Cargo Mass</dt><dd>{(cargoMass / 1000).toFixed(1)} t</dd></div>
              <div><dt>Store Items</dt><dd>{storesRecords.length}</dd></div>
              <div><dt>Shopping List</dt><dd>{shoppingList.length}</dd></div>
              <div><dt>Passengers</dt><dd>{activePassengerFiles}</dd></div>
              <div><dt>Passenger Cabins</dt><dd>6 occupied</dd></div>
              <div><dt>Galley Scope</dt><dd>{currentSoulsAboard} souls currently supported</dd></div>
            </dl>
            <p>Luca's view treats food, supplies, cargo, passenger comfort, and shopping intelligence as logistics, not decoration.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Stores / Shopping List</span><strong>{shoppingList.length} low</strong></header>
            <div className="shipOsMemoryList">
              {storesRecords.map((item) => (
                <article key={item.id} className={item.quantity < item.desiredMinimum ? 'watch' : 'nominal'}>
                  <span>{item.storage} | {item.purchaseLocation}</span>
                  <strong>{item.item}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>On Hand</dt><dd>{item.quantity.toLocaleString()} {item.unit}</dd></div>
                    <div><dt>Minimum</dt><dd>{item.desiredMinimum.toLocaleString()} {item.unit}</dd></div>
                    <div><dt>Last Price</dt><dd>{formatCredits(item.lastPrice)}</dd></div>
                    <div><dt>Expires</dt><dd>{item.expiration ?? 'N/A'}</dd></div>
                  </dl>
                  <p>{item.notes}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Cargo Manifest</span><strong>{(cargoMass / 1000).toFixed(1)} t</strong></header>
            <div className="shipOsCargoList">
              {cargoItems.map((item) => (
                <article key={item.id}>
                  <span>{item.category} | Bay {item.bay}</span>
                  <strong>{item.name}</strong>
                  <p>{item.quantity.toLocaleString()} units | {item.mass.toLocaleString()} kg</p>
                  <button type="button" onClick={() => setCargoItems((current) => current.filter((cargo) => cargo.id !== item.id))}>Remove</button>
                </article>
              ))}
            </div>
          </div>
          <form className="shipOsPanel shipOsPlotForm" onSubmit={addCargoItem}>
            <header><span>Add Cargo</span><strong>Manifest</strong></header>
            <label><span>Name</span><input value={cargoDraft.name} onChange={(event) => setCargoDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Category</span><input value={cargoDraft.category} onChange={(event) => setCargoDraft((current) => ({ ...current, category: event.target.value }))} /></label>
            <label><span>Quantity</span><input value={cargoDraft.quantity} onChange={(event) => setCargoDraft((current) => ({ ...current, quantity: event.target.value }))} inputMode="numeric" /></label>
            <label><span>Mass kg</span><input value={cargoDraft.mass} onChange={(event) => setCargoDraft((current) => ({ ...current, mass: event.target.value }))} inputMode="decimal" /></label>
            <label><span>Bay</span><input value={cargoDraft.bay} onChange={(event) => setCargoDraft((current) => ({ ...current, bay: event.target.value }))} /></label>
            <button type="submit">Add cargo</button>
          </form>
        </section>
      )
    }

    if (activeTab === 'surveyAid') {
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsOfficerBriefing">
            <header><span>Renn Harrow / Survey & Aid</span><strong>Carthage field verification</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Relief Authority</dt><dd>{formatCredits(reliefAuthorityBudget)}</dd></div>
              <div><dt>Volunteers</dt><dd>{reliefVolunteerBreakdown.reduce((total, row) => total + row.count, 0)}</dd></div>
              <div><dt>Volunteer Vessels</dt><dd>{reliefVolunteerVesselCount}</dd></div>
              <div><dt>Funds Spent</dt><dd>{formatCredits(0)}</dd></div>
              <div><dt>Deployments</dt><dd>0</dd></div>
              <div><dt>Known Locations</dt><dd>{locationRecords.length}</dd></div>
              <div><dt>Verified Locations</dt><dd>{locationRecords.filter((location) => /verified|surveyed/i.test(`${location.knowledgeState} ${location.confidence}`)).length}</dd></div>
              <div><dt>Ship Operating Funds</dt><dd>{formatCredits(operatingBalance)}</dd></div>
            </dl>
            <p>The Carthage Provisional Relief Authority is separate from Intrepid operating capital. Aid should release only against verified need, local authority, maintenance capability, and a real missing capability.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Crew Liaison Credential</span><strong>{rennHarrowCrewProfile.name}</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Billet</dt><dd>{rennHarrowCrewProfile.billet}</dd></div>
              <div><dt>Monthly Rate</dt><dd>{formatCredits(rennHarrowCrewProfile.rateMonthly)}</dd></div>
              <div><dt>Credential</dt><dd>{rennHarrowCrewProfile.credential}</dd></div>
              <div><dt>Quarters</dt><dd>{rennHarrowCrewProfile.quarters}</dd></div>
            </dl>
            <p>{rennHarrowCrewProfile.authority}</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Port Pico Volunteer Pool</span><strong>{reliefVolunteerBreakdown.reduce((total, row) => total + row.count, 0)}</strong></header>
            <div className="shipOsMemoryList">
              {reliefVolunteerBreakdown.map((row) => (
                <article key={row.specialty}>
                  <span>Registered</span>
                  <strong>{row.specialty}</strong>
                  <p>{row.count} volunteer{row.count === 1 ? '' : 's'} awaiting verified dispatch criteria.</p>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Field Assessment Schema</span><strong>Required evidence</strong></header>
            <div className="shipOsMemoryList">
              {['Population served', 'Local authority', 'Water', 'Food', 'Power', 'Atmosphere', 'Medical', 'Transport', 'Fabrication', 'Communications', 'Maintenance capacity', 'Employment', 'Shortages', 'Requested aid', 'Verification status', 'Evidence'].map((field) => (
                <article key={field}>
                  <span>Survey Field</span>
                  <strong>{field}</strong>
                  <p>Renn can feed this into a future Aid Project Packet once observed or verified.</p>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Known Location Survey Queue</span><strong>{locationRecords.length}</strong></header>
            <div className="shipOsMemoryList">
              {locationRecords.slice(0, 14).map((location) => (
                <article key={location.id}>
                  <span>{location.knowledgeState} | {location.confidence}</span>
                  <strong>{location.name}</strong>
                  <p>{location.whyHere}</p>
                  <small>{location.body} | landing: {location.landingSuitability}</small>
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => focusLocationRecord(location)}>Focus location</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'metagame') {
      const previewPortrait: GeneratedPortrait = {
        id: editingGeneratedPortraitId ?? 'portrait-maker-preview',
        name: portraitMakerDraft.name.trim() || 'Portrait Preview',
        skinTone: portraitMakerDraft.skinTone,
        hairColor: portraitMakerDraft.hairColor,
        eyeColor: portraitMakerDraft.eyeColor,
        uniformColor: portraitMakerDraft.uniformColor,
        accentColor: portraitMakerDraft.accentColor,
        hairStyle: portraitMakerDraft.hairStyle,
        notes: portraitMakerDraft.notes,
        createdAt: Date.now(),
      }

      return (
        <section className="shipOsTabGrid shipOsMetagameGrid">
          <div className="shipOsPanel shipOsMetagameCommand">
            <header><span>Metagame Console</span><strong>GM layer</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Portrait Library</dt><dd>{portraitOptions.length + generatedPortraits.length}</dd></div>
              <div><dt>Maker Portraits</dt><dd>{generatedPortraits.length}</dd></div>
              <div><dt>Backstage Records</dt><dd>{metagameRecords.length}</dd></div>
              <div><dt>Storage</dt><dd>{stateSyncStatus}</dd></div>
            </dl>
            <div className="shipOsActionRow">
              <button type="button" onClick={exportCampaignBackup}>Download backup</button>
              <label className="shipOsFileAction"><span>Restore backup</span><input type="file" accept="application/json,.json" onChange={importCampaignBackup} /></label>
            </div>
            <p>Use this tab for the machinery behind the campaign: hidden canon, not-yet-established facts, future hooks, and reusable portrait identities.</p>
          </div>

          <form className="shipOsPanel shipOsPortraitMakerForm" onSubmit={saveGeneratedPortrait}>
            <header><span>Portrait Maker</span><strong>{editingGeneratedPortrait ? 'Editing' : 'New portrait'}</strong></header>
            <div className="shipOsPortraitMakerStage">
              <GeneratedPortraitPreview portrait={previewPortrait} className="shipOsPortraitMakerPreview" />
              <dl className="shipOsDataList">
                <div><dt>Hair</dt><dd>{portraitMakerDraft.hairColor}</dd></div>
                <div><dt>Eyes</dt><dd>{portraitMakerDraft.eyeColor}</dd></div>
                <div><dt>Uniform</dt><dd>{portraitMakerDraft.uniformColor}</dd></div>
                <div><dt>Accent</dt><dd>{portraitMakerDraft.accentColor}</dd></div>
              </dl>
            </div>
            <label><span>Portrait Name</span><input value={portraitMakerDraft.name} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Ares dockside medic" /></label>
            <div className="shipOsCoordInputs">
              <label><span>Hair Style</span><select value={portraitMakerDraft.hairStyle} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, hairStyle: event.target.value as GeneratedPortrait['hairStyle'] }))}>
                <option value="swept">Swept</option>
                <option value="cropped">Cropped</option>
                <option value="long">Long</option>
                <option value="buzz">Buzz</option>
              </select></label>
              <label><span>Notes</span><input value={portraitMakerDraft.notes} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <div className="shipOsColorControls">
              <div className="shipOsColorControl">
                <label><span>Skin Tone</span><input type="color" value={portraitMakerDraft.skinTone} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, skinTone: event.target.value }))} /></label>
                <ColorSwatches label="Skin tone swatches" colors={skinTonePresets} value={portraitMakerDraft.skinTone} onChange={(skinTone) => setPortraitMakerDraft((current) => ({ ...current, skinTone }))} />
              </div>
              <div className="shipOsColorControl">
                <label><span>Hair Color</span><input type="color" value={portraitMakerDraft.hairColor} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, hairColor: event.target.value }))} /></label>
                <ColorSwatches label="Hair color swatches" colors={hairColorPresets} value={portraitMakerDraft.hairColor} onChange={(hairColor) => setPortraitMakerDraft((current) => ({ ...current, hairColor }))} />
              </div>
              <div className="shipOsColorControl">
                <label><span>Eye Color</span><input type="color" value={portraitMakerDraft.eyeColor} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, eyeColor: event.target.value }))} /></label>
                <ColorSwatches label="Eye color swatches" colors={eyeColorPresets} value={portraitMakerDraft.eyeColor} onChange={(eyeColor) => setPortraitMakerDraft((current) => ({ ...current, eyeColor }))} />
              </div>
              <div className="shipOsColorControl">
                <label><span>Uniform</span><input type="color" value={portraitMakerDraft.uniformColor} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, uniformColor: event.target.value }))} /></label>
                <ColorSwatches label="Uniform color swatches" colors={uniformColorPresets} value={portraitMakerDraft.uniformColor} onChange={(uniformColor) => setPortraitMakerDraft((current) => ({ ...current, uniformColor }))} />
              </div>
              <div className="shipOsColorControl">
                <label><span>Trim</span><input type="color" value={portraitMakerDraft.accentColor} onChange={(event) => setPortraitMakerDraft((current) => ({ ...current, accentColor: event.target.value }))} /></label>
                <ColorSwatches label="Uniform trim swatches" colors={accentColorPresets} value={portraitMakerDraft.accentColor} onChange={(accentColor) => setPortraitMakerDraft((current) => ({ ...current, accentColor }))} />
              </div>
            </div>
            <div className="shipOsActionRow">
              <button type="submit">{editingGeneratedPortrait ? 'Save portrait' : 'Create portrait'}</button>
              {editingGeneratedPortrait && <button type="button" onClick={cancelEditingGeneratedPortrait}>Cancel</button>}
            </div>
          </form>

          <div className="shipOsPanel shipOsGeneratedPortraitPanel">
            <header><span>Saved Portraits</span><strong>{generatedPortraits.length}</strong></header>
            <div className="shipOsGeneratedPortraitList">
              {generatedPortraits.length === 0 ? (
                <article>
                  <strong>No maker portraits saved yet</strong>
                  <p>Create one in the portrait maker, then it will appear at the front of crew and passenger portrait selectors.</p>
                </article>
              ) : generatedPortraits.map((portrait) => (
                <article key={portrait.id}>
                  <GeneratedPortraitPreview portrait={portrait} className="shipOsGeneratedPortraitCardPreview" />
                  <div>
                    <span>{portrait.hairStyle} | {portrait.notes || 'No notes'}</span>
                    <strong>{portrait.name}</strong>
                    <p>Hair {portrait.hairColor} | Eyes {portrait.eyeColor} | Uniform {portrait.uniformColor}</p>
                    <div className="shipOsActionRow">
                      <button type="button" onClick={() => startEditingGeneratedPortrait(portrait)}>Edit</button>
                      <button type="button" onClick={() => applyPortraitToCrewIntake(portrait)}>Use for crew intake</button>
                      <button type="button" onClick={() => applyPortraitToPassengerIntake(portrait)}>Use for passenger intake</button>
                      <button type="button" onClick={() => deleteGeneratedPortrait(portrait)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <form className="shipOsPanel shipOsMetagameForm" onSubmit={saveMetagameRecord}>
            <header><span>Behind Scenes Record</span><strong>{editingMetagameRecord ? 'Editing' : 'New file'}</strong></header>
            <label><span>Name</span><input value={metagameDraft.name} onChange={(event) => setMetagameDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Pelagos rumor source" /></label>
            <div className="shipOsCoordInputs">
              <label><span>Kind</span><select value={metagameDraft.kind} onChange={(event) => setMetagameDraft((current) => ({ ...current, kind: event.target.value as MetagameRecord['kind'] }))}>{metagameKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
              <label><span>Visibility</span><select value={metagameDraft.visibility} onChange={(event) => setMetagameDraft((current) => ({ ...current, visibility: event.target.value as MetagameRecord['visibility'] }))}>{metagameVisibilities.map((visibility) => <option key={visibility}>{visibility}</option>)}</select></label>
              <label><span>Status</span><input value={metagameDraft.status} onChange={(event) => setMetagameDraft((current) => ({ ...current, status: event.target.value }))} /></label>
            </div>
            <label><span>Tags</span><input value={metagameDraft.tags} onChange={(event) => setMetagameDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="comma, separated, tags" /></label>
            <label><span>Notes</span><textarea value={metagameDraft.notes} onChange={(event) => setMetagameDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="shipOsActionRow">
              <button type="submit">{editingMetagameRecord ? 'Save record' : 'Create record'}</button>
              {editingMetagameRecord && <button type="button" onClick={cancelEditingMetagameRecord}>Cancel</button>}
            </div>
          </form>

          <div className="shipOsPanel shipOsMetagameRecordsPanel">
            <header>
              <span>Backstage Database</span>
              <strong>{filteredMetagameRecords.length} / {metagameRecords.length}</strong>
            </header>
            <label className="shipOsMetagameFilter"><span>Filter</span><select value={metagameKindFilter} onChange={(event) => setMetagameKindFilter(event.target.value as 'All' | MetagameRecord['kind'])}>
              <option>All</option>
              {metagameKinds.map((kind) => <option key={kind}>{kind}</option>)}
            </select></label>
            <div className="shipOsMetagameRecordList">
              {filteredMetagameRecords.map((record) => (
                <article key={record.id}>
                  <span>{record.kind} | {record.visibility} | {record.status}</span>
                  <strong>{record.name}</strong>
                  <p>{record.notes}</p>
                  <small>{record.tags.length ? record.tags.join(' | ') : 'No tags'}</small>
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => startEditingMetagameRecord(record)}>Edit</button>
                    <button type="button" onClick={() => deleteMetagameRecord(record)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'logs') {
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel">
            <header><span>Ship Logs</span><strong>{shipLogs.length}</strong></header>
            <div className="shipOsLogs">
              {shipLogs.map((log) => (
                <article key={log.id}>
                  <span>{new Date(log.stamp).toLocaleString()} | {log.system}</span>
                  <p>{log.entry}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Timeline Replay Feed</span><strong>{timelineReplayEvents.length} events</strong></header>
            <div className="shipOsMemoryList">
              {timelineReplayEvents.slice(0, 18).map((event) => (
                <article key={`${event.source}-${event.id}`}>
                  <span>{new Date(event.stamp).toLocaleString()} | {event.source}</span>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'bank') {
      return (
        <section className="shipOsTabGrid">
          <div className="shipOsPanel shipOsBankCommand">
            <header><span>Operating Bank</span><strong>{formatCredits(operatingBalance)}</strong></header>
            <dl className="shipOsDataList">
              <div><dt>Month Income</dt><dd>{formatCredits(bankMonthIncome)}</dd></div>
              <div><dt>Month Expenses</dt><dd>{formatCredits(bankMonthExpenses)}</dd></div>
              <div><dt>Net This Month</dt><dd>{formatCredits(bankMonthIncome - bankMonthExpenses)}</dd></div>
              <div><dt>Recurring Burn</dt><dd>{formatCredits(recurringMonthlyBurn)} / mo</dd></div>
            </dl>
            <label><span>Ledger Month</span><input type="month" value={bankMonth} onChange={(event) => setBankMonth(event.target.value || currentMonthKey())} /></label>
            <p>Tracks the Intrepid venture account, monthly payroll, docking costs, passenger income, cargo revenue, refit spending, and recurring obligations.</p>
          </div>
          <div className="shipOsPanel">
            <header><span>Operational Money Links</span><strong>{jobRelationshipRows.reduce((total, row) => total + row.transactionCount, 0)} linked</strong></header>
            <div className="shipOsMemoryList">
              {jobRelationshipRows.filter((row) => row.transactionCount > 0 || row.job.payout > 0).map(({ job, transactionCount }) => (
                <article key={job.id}>
                  <span>{job.status} | {job.client}</span>
                  <strong>{job.title}</strong>
                  <dl className="shipOsPersonnelStats">
                    <div><dt>Contract</dt><dd>{formatCredits(job.payout)}</dd></div>
                    <div><dt>Ledger Links</dt><dd>{transactionCount}</dd></div>
                  </dl>
                  <p>{job.notes}</p>
                  <div className="shipOsActionRow">
                    <button type="button" onClick={() => openJobPacket(job.id)}>Open job packet</button>
                    <button type="button" onClick={() => setJobAsNavigationTarget(job)}>Project job route</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="shipOsPanel">
            <header><span>Monthly Ledger</span><strong>{bankMonthEntries.length} entries</strong></header>
            <div className="shipOsBankLedger">
              {bankMonthEntries.length === 0 ? (
                <article>
                  <span>No entries</span>
                  <strong>{bankMonth}</strong>
                  <p>No income or expense records logged for this month.</p>
                </article>
              ) : bankMonthEntries.map((entry) => (
                <article key={entry.id} className={entry.kind}>
                  <span>{entry.date} | {entry.category} | {entry.recurring ? 'Recurring' : 'One-time'}</span>
                  <strong>{entry.vendor}</strong>
                  <p>{entry.kind === 'income' ? '+' : '-'}{formatCredits(entry.amount)} {entry.notes && `| ${entry.notes}`}</p>
                  <button type="button" onClick={() => setBankEntries((current) => current.filter((item) => item.id !== entry.id))}>Delete entry</button>
                </article>
              ))}
            </div>
          </div>
          <form className="shipOsPanel shipOsBankForm" onSubmit={addBankEntry}>
            <header><span>Post Transaction</span><strong>Ledger</strong></header>
            <div className="shipOsCoordInputs">
              <label><span>Date</span><input type="date" value={bankDraft.date} onChange={(event) => setBankDraft((current) => ({ ...current, date: event.target.value }))} /></label>
              <label><span>Type</span><select value={bankDraft.kind} onChange={(event) => setBankDraft((current) => ({ ...current, kind: event.target.value as BankEntry['kind'] }))}><option value="expense">Expense</option><option value="income">Income</option></select></label>
              <label><span>Amount</span><input value={bankDraft.amount} onChange={(event) => setBankDraft((current) => ({ ...current, amount: event.target.value }))} inputMode="decimal" /></label>
            </div>
            <label><span>Vendor / Account</span><input value={bankDraft.vendor} onChange={(event) => setBankDraft((current) => ({ ...current, vendor: event.target.value }))} /></label>
            <label><span>Category</span><input value={bankDraft.category} onChange={(event) => setBankDraft((current) => ({ ...current, category: event.target.value }))} /></label>
            <label className="shipOsCheckRow"><input type="checkbox" checked={bankDraft.recurring} onChange={(event) => setBankDraft((current) => ({ ...current, recurring: event.target.checked }))} /><span>Recurring monthly obligation</span></label>
            <label><span>Notes</span><textarea value={bankDraft.notes} onChange={(event) => setBankDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit">Post transaction</button>
          </form>
          <div className="shipOsPanel">
            <header><span>Recurring Watch</span><strong>{formatCredits(recurringMonthlyBurn)} / mo</strong></header>
            <div className="shipOsBankLedger">
              {bankEntries.filter((entry) => entry.recurring).map((entry) => (
                <article key={entry.id} className={entry.kind}>
                  <span>{entry.category} | {entry.kind}</span>
                  <strong>{entry.vendor}</strong>
                  <p>{formatCredits(entry.amount)} monthly. {entry.notes}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="shipOsTabGrid">
        <div className="shipOsPanel shipOsOfficerBriefing">
          <header><span>Toren Vask / Engineering</span><strong>Configuration control and material readiness</strong></header>
          <dl className="shipOsDataList">
            <div><dt>Configurations</dt><dd>{shipConfigurations.length}</dd></div>
            <div><dt>Squawks</dt><dd>{engineeringOpenSquawkCount} open / {engineeringWatchSquawkCount} watch / {groundingSquawkCount} grounding</dd></div>
            <div><dt>Blueprints</dt><dd>{blueprintSnapshots.length}</dd></div>
            <div><dt>Latest Revision</dt><dd>{shipConfigurations[shipConfigurations.length - 1]?.version ?? 'INT-0001'}</dd></div>
          </dl>
          <p>Engineering retains the ship's technical memory: approved configurations, unresolved squawks, refit history, and blueprint structure. Live operations and bridge diagnostics are isolated in Telemetry.</p>
          <div className="shipOsActionRow">
            <button type="button" onClick={() => setActiveTab('telemetry')}>Open live telemetry</button>
          </div>
        </div>
        <div className="shipOsPanel">
          <header><span>Ship Configuration</span><strong>{shipConfigurations[shipConfigurations.length - 1]?.version ?? 'INT-0001'}</strong></header>
          <div className="shipOsMemoryList">
            {shipConfigurations.map((config) => (
              <article key={config.id}>
                <span>{config.version} | {config.date} | {config.engineer}</span>
                <strong>{config.change}</strong>
                <dl className="shipOsPersonnelStats">
                  <div><dt>Reason</dt><dd>{config.reason}</dd></div>
                  <div><dt>Yard</dt><dd>{config.shipyard}</dd></div>
                  <div><dt>Cost</dt><dd>{formatCredits(config.cost)}</dd></div>
                  <div><dt>Previous</dt><dd>{config.previousVersion ?? 'None'}</dd></div>
                </dl>
                <p>{config.notes}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="shipOsPanel">
          <header><span>Squawk List</span><strong>{engineeringOpenSquawkCount} open / {engineeringWatchSquawkCount} watch</strong></header>
          <div className="shipOsMemoryList">
            {squawkRecords.map((squawk) => (
              <article key={squawk.id} className={squawk.state.toLowerCase()}>
                <span>{squawk.state} | {squawk.system} | due {squawk.inspectionDue}</span>
                <strong>{squawk.title}</strong>
                <p>{squawk.condition}. {squawk.notes}</p>
                <small>Responsible: {squawk.responsible}</small>
                <div className="shipOsActionRow">
                  {(['OPEN', 'WATCH', 'DEFERRED', 'GROUNDING', 'CLOSED'] as SquawkState[]).map((state) => (
                    <button key={state} type="button" className={squawk.state === state ? 'active' : ''} aria-pressed={squawk.state === state} onClick={() => updateSquawkState(squawk, state)}>{state}</button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="shipOsPanel shipOsBlueprintIntake">
          <header><span>Blueprint Intake Bay</span><strong>{latestBlueprint ? latestBlueprint.name : 'Awaiting upload'}</strong></header>
          <label><span>Upload Blueprint XML / SBC</span><input type="file" accept=".sbc,.xml,.txt" onClick={(event) => { event.currentTarget.value = '' }} onChange={importBlueprintFile} /></label>
          {latestBlueprint && <p className="shipOsBlueprintLoaded">Loaded model: {latestBlueprint.fileName} | {latestBlueprint.blockCount.toLocaleString()} parsed blocks</p>}
          {blueprintError && <small className="shipOsTelemetryError">{blueprintError}</small>}
          <div className="shipOsBlueprintViewerPanel">
            <BlueprintModelViewer snapshot={latestBlueprint} preset={blueprintViewPreset} />
            <div className="shipOsBlueprintPresetControls" role="group" aria-label="Blueprint viewer preset">
              {blueprintViewPresetOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={blueprintViewPreset === option.id ? 'active' : ''}
                  aria-pressed={blueprintViewPreset === option.id}
                  onClick={() => setBlueprintViewPreset(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="shipOsBlueprintLegend">
              {(['armor', 'propulsion', 'power', 'cargo', 'control', 'weapon', 'life', 'utility', 'interior'] as BlueprintBlockCategory[]).map((category) => (
                <span key={category}><i style={{ backgroundColor: blueprintCategoryColor(category) }} />{category}</span>
              ))}
            </div>
          </div>
          {latestBlueprint ? (
            <dl className="shipOsDataList">
              <div><dt>File</dt><dd>{latestBlueprint.fileName}</dd></div>
              <div><dt>Grids</dt><dd>{latestBlueprint.gridCount}</dd></div>
              <div><dt>Blocks</dt><dd>{latestBlueprint.blockCount.toLocaleString()}</dd></div>
              <div><dt>Rendered</dt><dd>{(latestBlueprint.renderedBlockCount ?? latestBlueprint.modelBlocks?.length ?? 0).toLocaleString()} blocks</dd></div>
              <div><dt>Dimensions</dt><dd>{latestBlueprint.bounds ? `${latestBlueprint.bounds.maxX - latestBlueprint.bounds.minX + 1} x ${latestBlueprint.bounds.maxY - latestBlueprint.bounds.minY + 1} x ${latestBlueprint.bounds.maxZ - latestBlueprint.bounds.minZ + 1}` : 'No model bounds'}</dd></div>
              <div><dt>Cockpits</dt><dd>{latestBlueprint.cockpitCount}</dd></div>
              <div><dt>Thrusters</dt><dd>{latestBlueprint.thrusterCount}</dd></div>
              <div><dt>Gyros</dt><dd>{latestBlueprint.gyroCount}</dd></div>
              <div><dt>Cargo</dt><dd>{latestBlueprint.cargoCount}</dd></div>
              <div><dt>Power</dt><dd>{latestBlueprint.batteryCount} batteries / {latestBlueprint.reactorCount} reactors</dd></div>
              <div><dt>Jump Drives</dt><dd>{latestBlueprint.jumpDriveCount}</dd></div>
            </dl>
          ) : (
            <p>When you upload the Intrepid blueprint, ShipOS will extract grid count, block count, control seats, thrusters, gyros, cargo, power, connectors, and jump drives.</p>
          )}
          <div className="shipOsBlueprintList">
            {blueprintSnapshots.slice(0, 4).map((snapshot) => (
              <article key={snapshot.id}>
                <span>{new Date(snapshot.importedAt).toLocaleString()} | {snapshot.fileName}</span>
                <strong>{snapshot.name}</strong>
                <p>{snapshot.blockCount.toLocaleString()} blocks | {snapshot.gridCount} grid(s) | {snapshot.notes}</p>
                <button type="button" className="shipOsDangerButton" onClick={() => setBlueprintSnapshots((current) => current.filter((item) => item.id !== snapshot.id))}>Delete snapshot</button>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <main className={`shipOsFullPage${isNavigationExperience ? ' shipOsNavigationExperience' : ''}`} style={shipOsDisplayStyle}>
      <header className="shipOsTopBar">
        {!isNavigationExperience && <button type="button" onClick={onBack}>The Campaign Hall / Arcade</button>}
        <div>
          <span>{isNavigationExperience ? 'Free navigation companion' : 'Echoboard Gaming Space'}</span>
          <h1>{isNavigationExperience ? 'ShipOS Navigation' : 'ShipOS Command Computer'}</h1>
          <p>{isNavigationExperience
            ? 'Live planetary mapping, contacts, routes, and vessel telemetry.'
            : 'Carthage campaign command surface for mapping, waves, crew, passengers, cargo, logs, and ship systems aboard the Intrepid.'}</p>
        </div>
        <div className="shipOsTopBarStatus">
          <strong>{shipName}</strong>
          <small>{stateSyncStatus}</small>
        </div>
        {!isNavigationExperience && <div className={`shipOsTopBarAccount${isSignedIn ? ' signedIn' : ''}`} aria-label="EchoBoard Gaming account">
          <div>
            <span>EchoBoard Account</span>
            <strong>{isSignedIn ? accountName : 'This device is signed out'}</strong>
            <small>{isSignedIn ? accountMode : 'Sign in for remote telemetry'}</small>
          </div>
          <button type="button" onClick={isSignedIn ? onSignOut : onSignIn}>{isSignedIn ? 'Sign out' : 'Sign in'}</button>
        </div>}
      </header>

      {!isNavigationExperience && <nav className="shipOsTabs" aria-label="ShipOS tabs">
        {shipTabGroups.map((group) => (
          <section className={`shipOsTabGroup shipOsTabGroup-${group.id}`} key={group.id} aria-label={`${group.label} consoles`}>
            <span>{group.label}</span>
            <div>
              {group.tabs.map((tab) => (
                <button type="button" key={tab.id} className={activeTab === tab.id ? 'active' : ''} aria-current={activeTab === tab.id ? 'page' : undefined} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>}

      <details
        className="shipOsMapDeck shipOsMapDrawer"
        aria-label="ShipOS star map and velocity telemetry"
        open={isNavigationExperience || mapDrawerOpen}
        onToggle={(event) => {
          if (!isNavigationExperience) setMapDrawerOpen(event.currentTarget.open)
        }}
      >
        <summary className="shipOsMapDrawerSummary">
          <div className="shipOsMapDrawerTitle">
            <span>{isNavigationExperience ? 'Local star-system chart' : 'Carthage / Star System sandbox preset'}</span>
            <strong>Sensor Map & Velocity Telemetry</strong>
          </div>
          <dl className="shipOsMapDrawerStatus" aria-label="Current navigation summary">
            <div><dt>Contacts</dt><dd>{visibleContacts.length} / {allContacts.length}</dd></div>
            <div><dt>Range</dt><dd>{formatKm(routeDistance)}</dd></div>
            <div><dt>ETA</dt><dd>{routeEta}</dd></div>
            <div><dt>Planet Scale</dt><dd>{bodyScaleMode === 'true-scale' ? 'True SE' : 'Tactical'}</dd></div>
          </dl>
          <b className="shipOsMapDrawerCue" aria-hidden="true">
            <span className="shipOsMapDrawerClosed">Open Drawer</span>
            <span className="shipOsMapDrawerOpen">Close Drawer</span>
          </b>
        </summary>
        {mapDrawerOpen && <div className="shipOsMapDrawerBody">
          <div className="shipOsMapHeader">
            <div className="shipOsMapTitleBlock">
              <span>{isNavigationExperience ? 'Local star-system chart' : 'Carthage / Star System sandbox preset'}</span>
              <h2>{mapCameraMode === 'forward' ? 'Forward Sensor View' : 'Orbital Sensor Map'}</h2>
              <div className="shipOsMapFocusControls">
                <div className="shipOsMapControlRow">
                  <button type="button" onClick={focusIntrepidOnMap}>{isNavigationExperience ? 'Return to vessel' : 'Return to Intrepid'}</button>
                  <div className="shipOsMapScaleControls shipOsMapViewControls" role="group" aria-label="Map camera view">
                    <b>Camera</b>
                    <button type="button" className={mapCameraMode === 'overhead' ? 'active' : ''} aria-pressed={mapCameraMode === 'overhead'} onClick={focusIntrepidOnMap}>Overhead</button>
                    <button type="button" className={mapCameraMode === 'forward' ? 'active' : ''} aria-pressed={mapCameraMode === 'forward'} onClick={showForwardMapView}>Forward</button>
                  </div>
                  <div className="shipOsMapScaleControls" aria-label="Planet scale mode">
                    <b>Planet Scale</b>
                    <button type="button" className={bodyScaleMode === 'true-scale' ? 'active' : ''} aria-pressed={bodyScaleMode === 'true-scale'} onClick={() => setBodyScaleMode('true-scale')}>True SE</button>
                    <button type="button" className={bodyScaleMode === 'tactical' ? 'active' : ''} aria-pressed={bodyScaleMode === 'tactical'} onClick={() => setBodyScaleMode('tactical')}>Tactical</button>
                  </div>
                </div>
                <span className="shipOsMapFocusStatus">{mapCameraMode === 'forward'
                  ? `Forward track: ${plannedDestination.name}`
                  : `Pivot: ${mapFocusContactIsVisible ? mapLabelForContact(mapFocusContact) : `${mapLabelForContact(mapFocusContact)} hidden`}`}</span>
              </div>
            </div>
            <dl>
              <div><dt>Current X</dt><dd>{formatCoord(currentPosition.x)}</dd></div>
              <div><dt>Current Y</dt><dd>{formatCoord(currentPosition.y)}</dd></div>
              <div><dt>Current Z</dt><dd>{formatCoord(currentPosition.z)}</dd></div>
              <div><dt>Projected Path</dt><dd>{plannedDestination.name}</dd></div>
              <div><dt>Range</dt><dd>{formatKm(routeDistance)}</dd></div>
              <div><dt>ETA</dt><dd>{routeEta}</dd></div>
              <div><dt>Chart</dt><dd>{calibratedBodyCount ? `${calibratedBodyCount} calibrated` : 'Preset'} / {bodyScaleMode === 'true-scale' ? 'True SE' : 'Tactical'}</dd></div>
            </dl>
          </div>
          <ContactFilterChecklist
            contacts={allContacts}
            filters={normalizedContactFilters}
            factionOptions={contactFactionOptions}
            visibleCount={visibleContacts.length}
            memoryCount={archivedEncounterMemory.length}
            memoryVisible={encounterMemoryVisible}
            onToggleClass={setContactClassFilter}
            onToggleIff={setContactIffFilter}
            onToggleFaction={setContactFactionFilter}
            onSetAll={setAllContactFilters}
            onToggleMemory={setEncounterMemoryVisible}
          />
          <ShipSystemMap contacts={visibleContacts} encounterMemory={visibleEncounterMemory} systemBodies={calibratedStarSystemBodies} currentPosition={currentPosition} currentShipContact={currentShipContact} flightRoutes={flightRoutes} focusContactId={mapFocusContactIsVisible ? mapFocusContact.id : currentShipContactId} focusRequestId={mapFocusRequest} projectedContact={plannedDestination} selectedContactId={selectedContactId} bodyScaleMode={bodyScaleMode} cameraMode={mapCameraMode} onSelectContact={handleSelectContact} telemetryTrail={telemetryHistory} />
          <section className="shipOsTacticalCommandBar" aria-label="Tactical alarm controls">
            <button
              type="button"
              className={`shipOsMasterAlarm shipOsMasterAlarm-${masterAlarm.level}`}
              disabled={masterAlarm.level !== 'critical'}
              onClick={resetMasterAlarm}
              aria-label={`Master Alarm ${masterAlarm.level}${masterAlarm.level === 'critical' ? ', press to reset' : ''}`}
            >
              <span>Master</span>
              <strong>Alarm</strong>
            </button>
            <button type="button" onClick={() => triggerMasterCaution('Manual caution test')}>
              <span>Master Alarm</span>
              <strong>Caution Test</strong>
            </button>
            <button type="button" onClick={() => triggerMasterWarning('Manual warning test')}>
              <span>Master Alarm</span>
              <strong>Warning Test</strong>
            </button>
            <button
              type="button"
              className={`shipOsAlarmSoundUplink ${alarmSoundUplinkEnabled ? 'active' : ''}`}
              aria-pressed={alarmSoundUplinkEnabled}
              onClick={toggleAlarmSoundUplink}
              title="Arms ShipOS alarm-output requests. The game-side sound-block command channel is the next bridge evolution."
            >
              <span>Alarm Sound</span>
              <strong>Uplink {alarmSoundUplinkEnabled ? 'Enabled' : 'Disabled'}</strong>
            </button>
            <output aria-live="polite">
              <span>{masterAlarm.level === 'critical' ? 'Warning' : masterAlarm.level === 'caution' ? 'Caution' : 'Watch'}</span>
              <strong>{masterAlarm.reason}</strong>
              <small>AGL {formatAltitude(alarmFlightDirector.surfaceAltitude)} / nearest asteroid {formatAltitude(nearestAsteroidRange)}</small>
            </output>
          </section>
          <ShipFlightDirector packet={lastTelemetryPacket} currentPosition={currentPosition} bodies={calibratedStarSystemBodies} />
          <section className="shipOsVelocityTelemetry" aria-label="Relative and absolute velocity telemetry">
            <header>
              <div>
                <span>Velocity Telemetry</span>
                <strong>{liveVectorContacts} live vectors / {velocityTelemetryRows.length} tracked objects</strong>
              </div>
              <small>{lastTelemetryPacket?.stamp ? `Last packet ${lastTelemetryPacket.stamp}` : 'Awaiting live motion packet'}</small>
            </header>
            <dl className="shipOsVelocitySummary">
              <div><dt>Ownship Absolute</dt><dd>{formatMetersPerSecondValue(velocityTelemetryRows[0]?.absoluteSpeed, 'No ownship vector')}</dd></div>
              <div><dt>Ownship Vector</dt><dd>{formatVelocityVector(velocityTelemetryRows[0]?.vector ?? null)}</dd></div>
              <div><dt>Selected</dt><dd>{selectedVelocityTelemetry?.label ?? 'No target'}</dd></div>
              <div><dt>Selected Absolute</dt><dd>{formatMetersPerSecondValue(selectedVelocityTelemetry?.absoluteSpeed)}</dd></div>
              <div><dt>Selected Relative</dt><dd>{formatMetersPerSecondValue(selectedVelocityTelemetry?.relativeSpeed)}</dd></div>
              <div><dt>Range Rate</dt><dd>{formatRangeRate(selectedVelocityTelemetry?.rangeRate)}</dd></div>
            </dl>
            <div className="shipOsVelocityTableWrap">
              <table className="shipOsVelocityTable">
                <thead>
                  <tr>
                    <th scope="col">Object</th>
                    <th scope="col">Class</th>
                    <th scope="col">Range</th>
                    <th scope="col">Absolute</th>
                    <th scope="col">Relative</th>
                    <th scope="col">Range Rate</th>
                    <th scope="col">Bearing</th>
                    <th scope="col">Elevation</th>
                    <th scope="col">Vector</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {velocityTelemetryRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.selected ? 'selected' : ''}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectContact(row.contactId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleSelectContact(row.contactId)
                        }
                      }}
                    >
                      <th scope="row">{row.label}</th>
                      <td>{row.kind}</td>
                      <td>{row.rangeMeters === null ? 'No range' : formatKm(row.rangeMeters)}</td>
                      <td>{formatMetersPerSecondValue(row.absoluteSpeed)}</td>
                      <td>{formatMetersPerSecondValue(row.relativeSpeed)}</td>
                      <td>{formatRangeRate(row.rangeRate)}</td>
                      <td>{formatDegrees(row.bearingDegrees)}</td>
                      <td>{formatDegrees(row.elevationDegrees)}</td>
                      <td>{formatVelocityVector(row.vector)}</td>
                      <td>{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Absolute speed is each object relative to the game world. Relative speed and range rate are calculated against the current vessel; negative range rate is closing, positive range rate is opening.</p>
          </section>
        </div>}
      </details>

      {!isNavigationExperience && renderTab()}

      {!isNavigationExperience && <details className="shipOsPanel shipOsUtilityDrawer shipOsInboxPanel" aria-label="Ship inbox" open={activeTab === 'captain' ? undefined : true}>
        <summary><span>Ship Inbox</span><strong>{awaitingResponses} action items</strong></summary>
        <div className="shipOsUtilityDrawerBody">
        <div className="shipOsInbox">
          {waves.slice(0, 12).map((wave) => (
            <article key={wave.id} className={wave.direction}>
              <span>{wave.network} | {wave.direction} | {wave.status === 'awaiting-response' ? `reply in ${minutesUntil(wave.responseDueAt)}` : wave.status}</span>
              <strong>{wave.subject}</strong>
              <p>{wave.from} to {wave.to}: {wave.body}</p>
              <div className="shipOsActionRow">
                <button type="button" className="shipOsDangerButton" onClick={() => deleteWave(wave)}>Delete wave</button>
              </div>
            </article>
          ))}
        </div>
        </div>
      </details>}

      <details className="shipOsPanel shipOsUtilityDrawer shipOsDisplayPanel" aria-label="Visibility and typography settings" open={activeTab === 'captain' ? undefined : true}>
        <summary><span>Visibility & Typography</span><strong>{displayFontSize}px / {displayFontFace.label}</strong></summary>
        <div className="shipOsUtilityDrawerBody">
        <div className="shipOsDisplayControls">
          <label className="shipOsFontSizeControl">
            <span>Interface Text Size</span>
            <div>
              <button type="button" aria-label="Decrease interface text size" disabled={displayFontSize <= 10} onClick={() => setDisplayPreferences((current) => ({ ...current, fontSize: Math.max(10, displayFontSize - 1) }))}>-</button>
              <input type="range" min="10" max="18" step="1" value={displayFontSize} onChange={(event) => setDisplayPreferences((current) => ({ ...current, fontSize: Number(event.target.value) }))} />
              <output aria-live="polite">{displayFontSize}px</output>
              <button type="button" aria-label="Increase interface text size" disabled={displayFontSize >= 18} onClick={() => setDisplayPreferences((current) => ({ ...current, fontSize: Math.min(18, displayFontSize + 1) }))}>+</button>
            </div>
          </label>
          <fieldset className="shipOsFontFaceControl">
            <legend>Typeface</legend>
            <div>
              {shipOsFontFaceOptions.map((option) => (
                <button key={option.id} type="button" className={displayFontFace.id === option.id ? 'active' : ''} aria-pressed={displayFontFace.id === option.id} onClick={() => setDisplayPreferences((current) => ({ ...current, fontFace: option.id }))}>{option.label}</button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="shipOsDisplayReset" onClick={() => setDisplayPreferences(defaultShipOsDisplayPreferences)}>Reset display</button>
        </div>
        </div>
      </details>

      {personnelFileSelection && (openPersonnelCrewMember || openPersonnelPassenger) && (
        <div className="shipOsModalBackdrop" role="presentation" onMouseDown={closePersonnelFile}>
          <section
            ref={personnelFileModalRef}
            className="shipOsModal shipOsPersonnelFileModal"
            role="dialog"
            aria-modal="true"
            aria-label={`Editable ${personnelFileSelection.kind} file`}
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>{personnelFileSelection.kind === 'crew' ? 'Naval Personnel File' : 'Passenger Manifest File'}</span>
              <h2>{openPersonnelCrewMember?.name ?? openPersonnelPassenger?.name}</h2>
              <button type="button" aria-label="Close personnel file" onClick={closePersonnelFile}>Close</button>
            </header>
            {openPersonnelCrewMember && renderCrewForm(
              crewEditDraft,
              setCrewEditDraft,
              saveCrewMember,
              'Personnel Record',
              openPersonnelCrewMember.serviceNumber || 'Unfiled',
              'Save personnel file',
              closePersonnelFile,
            )}
            {openPersonnelPassenger && renderPassengerForm(
              passengerEditDraft,
              setPassengerEditDraft,
              savePassengerFile,
              'Passenger Record',
              openPersonnelPassenger.manifestId,
              'Save passenger file',
              closePersonnelFile,
            )}
          </section>
        </div>
      )}

      {selectedContact && (
        <div className="shipOsModalBackdrop" role="presentation" onMouseDown={() => setSelectedContactId(null)}>
          <section ref={contactModalRef} className="shipOsModal" role="dialog" aria-modal="true" aria-label={`${selectedContactTitle} contact file`} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span>{selectedContact.kind}</span>
              <h2>{selectedContactTitle}</h2>
              <button type="button" aria-label={`Close ${selectedContactTitle} contact file`} onClick={() => setSelectedContactId(null)}>Close</button>
            </header>
            <dl className="shipOsDataList">
              <div><dt>Type</dt><dd>{contactKindLabel(selectedContact.kind)}</dd></div>
              <div><dt>Faction</dt><dd>{selectedFactionName || 'Unassigned / Unknown'}</dd></div>
              <div><dt>Status</dt><dd>{selectedContact.status}</dd></div>
              <div><dt>X</dt><dd>{formatCoord(selectedContact.x)}</dd></div>
              <div><dt>Y</dt><dd>{formatCoord(selectedContact.y)}</dd></div>
              <div><dt>Z</dt><dd>{formatCoord(selectedContact.z)}</dd></div>
              <div><dt>Relative</dt><dd>{(distanceMeters(currentPosition, selectedContact) / 1000).toFixed(1)} km</dd></div>
              <div><dt>Absolute Speed</dt><dd>{formatMetersPerSecondValue(selectedVelocityTelemetry?.absoluteSpeed)}</dd></div>
              <div><dt>Relative Speed</dt><dd>{formatMetersPerSecondValue(selectedVelocityTelemetry?.relativeSpeed)}</dd></div>
              <div><dt>Range Rate</dt><dd>{formatRangeRate(selectedVelocityTelemetry?.rangeRate)}</dd></div>
              <div><dt>Velocity Vector</dt><dd>{formatVelocityVector(selectedVelocityTelemetry?.vector ?? null)}</dd></div>
              {selectedDefenseEnvelope && <div><dt>Defense Envelope</dt><dd>{selectedDefenseEnvelope.label}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.radiusMeters && <div><dt>Radius</dt><dd>{formatKm(selectedContact.radiusMeters)}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.radiusMeters && <div><dt>Diameter</dt><dd>{formatKm(selectedContact.radiusMeters * 2)}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.generatorName && <div><dt>SE Generator</dt><dd>{selectedContact.generatorName}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.entityId && <div><dt>SE Entity ID</dt><dd>{selectedContact.entityId}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.storageName && <div><dt>Voxel Storage</dt><dd>{selectedContact.storageName}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.hasAtmosphere !== undefined && <div><dt>Atmosphere</dt><dd>{selectedContact.hasAtmosphere ? 'Present' : 'None'}</dd></div>}
              {selectedContact.kind === 'body' && selectedContact.surfaceGravity !== undefined && <div><dt>Surface Gravity</dt><dd>{selectedContact.surfaceGravity.toFixed(2)} g</dd></div>}
              {selectedContact.relationship && <div><dt>Relationship</dt><dd>{selectedContact.relationship}</dd></div>}
              {selectedContact.contactSource && <div><dt>Source</dt><dd>{selectedContact.contactSource === 'planet-registry' ? 'Live in-game planet registry' : selectedContact.contactSource}</dd></div>}
              {selectedContact.antennaName && <div><dt>Antenna</dt><dd>{selectedContact.antennaName}</dd></div>}
              {selectedContactOriginalName && <div><dt>Original Name</dt><dd>{selectedContactOriginalName}</dd></div>}
              {selectedBodyCalibration && <div><dt>Chart Source</dt><dd>{calibrationSummaryForBody(selectedContact, planetaryChartOverrides)}</dd></div>}
              {selectedContact.kind === 'asteroid' && <div><dt>Map Label</dt><dd>{asteroidShortLabel(selectedContact)}</dd></div>}
              {selectedContact.rangeMeters !== undefined && <div><dt>Sensor Range</dt><dd>{formatKm(selectedContact.rangeMeters)}</dd></div>}
              <div><dt>GPS</dt><dd>GPS:{selectedContactTitle}:{Math.round(selectedContact.x)}:{Math.round(selectedContact.y)}:{Math.round(selectedContact.z)}:</dd></div>
            </dl>
            <section className="shipOsDesignationPanel" aria-label={`${selectedContactTitle} IFF designation`}>
              <header>
                <span>IFF Designation</span>
                <strong>{selectedManualDesignation ? contactDispositionLabel(selectedManualDesignation) : `Auto: ${contactDispositionLabel(selectedInferredIff)}`}</strong>
              </header>
              <div className="shipOsDesignationGrid">
                {contactDispositionOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`shipOsDesignationButton disposition-${option.id}${selectedDesignation === option.id ? ' active' : ''}`}
                    aria-pressed={selectedDesignation === option.id}
                    disabled={!selectedCanBeDesignated}
                    onClick={() => setSelectedContactDesignation(option.id)}
                  >
                    <span>{option.label}</span>
                    <small>{option.note}</small>
                  </button>
                ))}
              </div>
              <small>{selectedCanBeDesignated ? 'Owned grids receive green 4 km / 8 km defense envelopes. Neutral contacts retain a white 4 km traffic envelope. Hostile contacts and asteroids use markers only; asteroid proximity still drives the 2 km caution alarm.' : 'Ownship and planetary body disposition is locked by the system chart.'}</small>
            </section>
            <section className="shipOsDesignationPanel shipOsFactionPanel" aria-label={`${selectedContactTitle} faction assignment`}>
              <header>
                <span>Faction Assignment</span>
                <strong>{selectedManualFaction ? selectedManualFaction : selectedFactionName ? `Auto: ${selectedFactionName}` : 'Unassigned'}</strong>
              </header>
              <label>
                <span>Faction</span>
                <input
                  value={modalDraft.factionName}
                  disabled={!selectedCanAssignFaction}
                  list="shipOsFactionOptions"
                  onChange={(event) => setModalDraft((current) => ({ ...current, factionName: event.target.value }))}
                  placeholder="Type or select a faction"
                />
              </label>
              <datalist id="shipOsFactionOptions">
                {contactFactionOptions.filter((option) => option.id !== unassignedFactionFilterId).map((option) => (
                  <option key={option.id} value={option.label} />
                ))}
              </datalist>
              <div className="shipOsFactionQuickGrid">
                {contactFactionOptions.filter((option) => option.id !== unassignedFactionFilterId).slice(0, 9).map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={selectedFactionName === option.label ? 'active' : ''}
                    aria-pressed={selectedFactionName === option.label}
                    disabled={!selectedCanAssignFaction}
                    onClick={() => setSelectedContactFaction(option.label)}
                  >
                    <span>{option.label}</span>
                    <small>{option.source}</small>
                  </button>
                ))}
                <button type="button" disabled={!selectedCanAssignFaction} onClick={() => setSelectedContactFaction('')}>
                  <span>Auto / Clear</span>
                  <small>Use telemetry or inference</small>
                </button>
              </div>
              <small>{selectedCanAssignFaction ? 'Typing a new faction and saving creates a backstage Faction record for future contact assignments.' : 'Ownship faction is fixed to DSV Intrepid.'}</small>
            </section>
            <label><span>Name</span><input value={modalDraft.name} disabled={!selectedCanEditRecord} onChange={(event) => setModalDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Classification</span><input value={modalDraft.className} disabled={!selectedCanEditRecord} onChange={(event) => setModalDraft((current) => ({ ...current, className: event.target.value }))} /></label>
            <label><span>Information</span><textarea value={modalDraft.notes} onChange={(event) => setModalDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <section className="shipOsContactImageSection" aria-label={`${selectedContactTitle} attached imagery`}>
              <header>
                <span>Attached Imagery</span>
                <strong>{selectedContactImages.length} files</strong>
              </header>
              <label><span>Attach Screenshot</span><input type="file" accept="image/*" multiple onClick={(event) => { event.currentTarget.value = '' }} onChange={attachImagesToSelectedContact} /></label>
              {imageryError && <small className="shipOsTelemetryError">{imageryError}</small>}
              <div className="shipOsImageGrid shipOsModalImageGrid">
                {selectedContactImages.map((image) => (
                  <article key={image.id}>
                    <img src={image.dataUrl} alt={image.caption || `${selectedContactTitle} screenshot`} />
                    <span>{new Date(image.createdAt).toLocaleString()} | {image.width} x {image.height} | {formatByteSize(image.byteSize)}</span>
                    <label><span>Caption</span><input value={image.caption} onChange={(event) => updateContactImageCaption(image.id, event.target.value)} /></label>
                    <div className="shipOsActionRow">
                      <a href={image.dataUrl} download={image.fileName || `${selectedContactTitle}.jpg`}>Download image</a>
                      <button type="button" onClick={() => deleteContactImage(image.id)}>Delete image</button>
                    </div>
                  </article>
                ))}
                {!selectedContactImages.length && (
                  <article className="shipOsEmptyState">
                    <strong>No archived imagery</strong>
                    <span>{selectedContactTitle}</span>
                  </article>
                )}
              </div>
            </section>
            <div className="shipOsModalActions">
              {selectedContact.id !== currentShipContactId && <button type="button" onClick={() => setNavigationDestination(selectedContact)}>Project flight path</button>}
              {selectedContact.id !== currentShipContactId && hailableContact(selectedContact) && <button type="button" onClick={() => prepareHailDraft(selectedContact)}>Prepare hail</button>}
              {selectedContact.id !== currentShipContactId && <button type="button" onClick={updateCurrentFromContact}>Move Intrepid here</button>}
              <button type="button" onClick={saveContactModal}>Save file</button>
              {selectedIsCustom && <button type="button" onClick={deleteSelectedContact}>Delete contact</button>}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
