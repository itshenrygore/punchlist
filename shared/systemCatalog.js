// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — SYSTEM CATALOG v3
// 1,086 items across 8 trades. Residential + Commercial.
// Lean structure: {t, c, n, d, lo, hi, p, syn}
// Generated: 2025-03. Refresh monthly via scripts/refresh-catalog.js
// ═══════════════════════════════════════════════════════════════

const C = [
// ── PLUMBER (90 items) ──
{t:'Plumber',c:'Services',n:'Plumbing diagnostic / service call',d:'First-hour site assessment and scope confirmation',lo:135,hi:195,p:100,syn:['service call','diagnostic','trip charge','callout']},
{t:'Plumber',c:'Services',n:'Camera / drain inspection',d:'Drain camera to locate blockage or damage below grade',lo:150,hi:350,p:90,syn:['camera','drain camera','sewer camera','video inspection']},
{t:'Plumber',c:'Services',n:'Leak detection',d:'Locate hidden leak via pressure test or inspection',lo:145,hi:280,p:85,syn:['leak detection','find leak','pressure test']},
{t:'Plumber',c:'Services',n:'Backflow test',d:'Annual backflow preventer test and certification',lo:75,hi:175,p:65,syn:['backflow test','rpz test','annual test']},
{t:'Plumber',c:'Services',n:'Plumbing permit',d:'Municipal permit for plumbing work requiring inspection',lo:80,hi:250,p:70,syn:['permit','plumbing permit','inspection']},
{t:'Plumber',c:'Services',n:'Disposal and cleanup',d:'Haul away old fixtures, clean work area',lo:45,hi:120,p:60,syn:['disposal','cleanup','haul away','remove old']},
{t:'Plumber',c:'Labour',n:'Install kitchen faucet',d:'Remove old, install new, connect supply lines, test',lo:185,hi:350,p:98,syn:['kitchen faucet','faucet install','tap install']},
{t:'Plumber',c:'Labour',n:'Install bathroom faucet',d:'Remove old, install new bathroom faucet, connect and test',lo:165,hi:310,p:95,syn:['bathroom faucet','lav faucet','vanity faucet']},
{t:'Plumber',c:'Labour',n:'Install toilet',d:'Remove old toilet, set new with wax ring, connect, test',lo:195,hi:380,p:97,syn:['toilet install','toilet replacement','toilet swap']},
{t:'Plumber',c:'Labour',n:'Install garburator',d:'Mount and wire disposal unit under kitchen sink',lo:165,hi:320,p:80,syn:['garburator','garbage disposal','insinkerator']},
{t:'Plumber',c:'Labour',n:'Install dishwasher connection',d:'Connect water supply, drain, verify no leaks',lo:120,hi:240,p:75,syn:['dishwasher hookup','dishwasher connection']},
{t:'Plumber',c:'Labour',n:'Install gas water heater',d:'Remove old, install new gas water heater, connect and startup',lo:450,hi:850,p:96,syn:['water heater install','hot water tank','gas water heater','hwt']},
{t:'Plumber',c:'Labour',n:'Install electric water heater',d:'Remove old, install new electric water heater, connect and test',lo:380,hi:720,p:88,syn:['electric water heater','electric tank','electric hwt']},
{t:'Plumber',c:'Labour',n:'Install tankless water heater',d:'Mount, pipe, vent, and commission tankless unit',lo:650,hi:1400,p:82,syn:['tankless','on demand','instant hot water','navien','rinnai']},
{t:'Plumber',c:'Labour',n:'Install sump pump',d:'Install sump pump, check valve, and discharge line',lo:350,hi:680,p:78,syn:['sump pump','sump install','ejector pump']},
{t:'Plumber',c:'Labour',n:'Install hose bib',d:'Install exterior frost-free faucet',lo:165,hi:340,p:70,syn:['hose bib','outdoor faucet','exterior tap','garden tap']},
{t:'Plumber',c:'Labour',n:'Install shower valve',d:'Install or replace shower valve, trim kit, and test',lo:280,hi:550,p:85,syn:['shower valve','shower trim','mixing valve']},
{t:'Plumber',c:'Labour',n:'Install bathtub drain',d:'Replace tub waste and overflow assembly',lo:145,hi:290,p:72,syn:['tub drain','overflow','waste and overflow']},
{t:'Plumber',c:'Labour',n:'Install cleanout',d:'Add accessible drain cleanout for future maintenance',lo:155,hi:340,p:62,syn:['cleanout','drain cleanout','access cleanout']},
{t:'Plumber',c:'Labour',n:'Install laundry connections',d:'Water supply and drain for washing machine',lo:195,hi:420,p:71,syn:['laundry box','washing machine hookup','washer box']},
{t:'Plumber',c:'Labour',n:'Install water softener',d:'Connect water softener to main supply with bypass',lo:280,hi:550,p:60,syn:['water softener','softener install','water treatment']},
{t:'Plumber',c:'Labour',n:'Install backflow preventer',d:'Install and test backflow prevention device',lo:195,hi:450,p:58,syn:['backflow','backflow preventer','RPZ','double check']},
{t:'Plumber',c:'Labour',n:'Install recirculation pump',d:'Install hot water recirc pump and timer',lo:250,hi:520,p:55,syn:['recirc pump','recirculation','hot water recirc']},
{t:'Plumber',c:'Labour',n:'Install kitchen sink',d:'Mount undermount or drop-in sink, connect plumbing, test',lo:195,hi:420,p:82,syn:['kitchen sink','sink install','undermount sink']},
{t:'Plumber',c:'Labour',n:'Install bathroom vanity plumbing',d:'Connect vanity drain, supply lines, and faucet',lo:195,hi:380,p:80,syn:['vanity plumbing','vanity install','bathroom vanity']},
{t:'Plumber',c:'Labour',n:'Install gas line',d:'Run gas line for BBQ, dryer, range, or fireplace',lo:250,hi:550,p:72,syn:['gas line','gas hookup','gas piping','bbq gas']},
{t:'Plumber',c:'Labour',n:'Install water filter system',d:'Mount and connect whole-home or under-sink filter',lo:180,hi:420,p:58,syn:['water filter','filtration','reverse osmosis','ro system']},
{t:'Plumber',c:'Labour',n:'Replace shutoff valve',d:'Replace seized or leaking shutoff valve',lo:120,hi:280,p:75,syn:['shutoff valve','shut off','isolation valve','gate valve']},
{t:'Plumber',c:'Labour',n:'Replace wax ring / toilet seal',d:'Pull toilet, replace wax ring, reset and test',lo:120,hi:220,p:72,syn:['wax ring','toilet seal','toilet leak at base']},
{t:'Plumber',c:'Labour',n:'Replace P-trap / drain trap',d:'Replace trap assembly under sink or tub',lo:85,hi:185,p:68,syn:['p-trap','drain trap','trap replacement']},
{t:'Plumber',c:'Labour',n:'Replace expansion tank',d:'Replace thermal expansion tank on water heater',lo:120,hi:260,p:55,syn:['expansion tank','thermal expansion']},
{t:'Plumber',c:'Labour',n:'Replace main shutoff valve',d:'Replace failed main water shutoff valve',lo:350,hi:750,p:65,syn:['main shutoff','main valve','water main']},
{t:'Plumber',c:'Labour',n:'Replace shower cartridge',d:'Replace shower valve cartridge to fix temperature or leak',lo:165,hi:320,p:78,syn:['shower cartridge','cartridge replacement','moen cartridge']},
{t:'Plumber',c:'Labour',n:'Repair toilet internals',d:'Replace flapper, fill valve, or handle',lo:95,hi:195,p:80,syn:['toilet repair','running toilet','flapper','fill valve']},
{t:'Plumber',c:'Labour',n:'Repair faucet',d:'Fix dripping or leaking faucet — cartridge or seats',lo:95,hi:220,p:82,syn:['faucet repair','dripping faucet','leaky faucet']},
{t:'Plumber',c:'Labour',n:'Repair pipe leak',d:'Locate and repair visible or confirmed pipe leak',lo:195,hi:480,p:85,syn:['pipe leak','pipe repair','burst pipe','leaking pipe']},
{t:'Plumber',c:'Labour',n:'Drain cleaning / augering',d:'Clear blocked drain with auger or hydro jet',lo:165,hi:380,p:88,syn:['drain cleaning','augering','snake','hydro jet','blocked drain']},
{t:'Plumber',c:'Labour',n:'Sewer line repair',d:'Excavate and repair failed sewer line section',lo:1200,hi:4500,p:50,syn:['sewer repair','sewer line','sewer replacement']},
{t:'Plumber',c:'Labour',n:'Thaw frozen pipe',d:'Locate and safely thaw frozen water pipe',lo:195,hi:450,p:55,syn:['frozen pipe','thaw pipe','winter emergency']},
{t:'Plumber',c:'Labour',n:'Install water hammer arrestor',d:'Install arrestor to stop banging pipes',lo:85,hi:195,p:50,syn:['water hammer','pipe banging','arrestor']},
{t:'Plumber',c:'Labour',n:'Rough-in plumbing',d:'New pipe runs for fixtures during renovation',lo:450,hi:1200,p:60,syn:['rough in','rough-in','new pipe runs','renovation plumbing']},
{t:'Plumber',c:'Labour',n:'Poly B pipe replacement',d:'Replace polybutylene piping with PEX',lo:2500,hi:8000,p:55,syn:['poly b','polybutylene','pex upgrade','repipe']},
{t:'Plumber',c:'Labour',n:'Install outdoor shower',d:'Plumb exterior shower with hot/cold supply and drain',lo:450,hi:950,p:40,syn:['outdoor shower','exterior shower','pool shower']},
{t:'Plumber',c:'Labour',n:'Install pot filler',d:'Mount and connect pot filler faucet over stove',lo:250,hi:480,p:45,syn:['pot filler','stove faucet','kitchen pot filler']},
{t:'Plumber',c:'Labour',n:'Winterize property',d:'Blow out lines, drain fixtures for seasonal shutdown',lo:165,hi:345,p:50,syn:['winterize','blow out','seasonal','cottage']},
{t:'Plumber',c:'Labour',n:'Spring startup',d:'Reconnect water, pressurize, test all fixtures',lo:120,hi:280,p:48,syn:['spring startup','recommission','seasonal opening']},
{t:'Plumber',c:'Materials',n:'Supply lines and fittings',d:'Braided supply lines, compression fittings, adapters',lo:15,hi:65,p:70,syn:['supply lines','fittings','braided hose','connectors']},
{t:'Plumber',c:'Materials',n:'Wax ring and bolts',d:'Wax ring, closet bolts, and flange hardware',lo:8,hi:25,p:65,syn:['wax ring','toilet bolts','flange hardware']},
{t:'Plumber',c:'Materials',n:'PEX piping and fittings',d:'PEX tubing, crimp rings, manifold connections',lo:50,hi:250,p:60,syn:['pex','pex pipe','pex fittings','crimp rings','rough-in','rough in','water line','supply pipe']},
{t:'Plumber',c:'Materials',n:'Copper pipe and fittings',d:'Copper pipe, solder fittings, flux, valves',lo:80,hi:350,p:55,syn:['copper','copper pipe','solder fittings']},
{t:'Plumber',c:'Materials',n:'ABS / PVC drain pipe',d:'Drain pipe, fittings, cement, cleanout fittings',lo:30,hi:150,p:58,syn:['abs','pvc','drain pipe','drain fittings','rough-in','rough in','dwv','vent pipe','basement drain']},
{t:'Plumber',c:'Materials',n:'Caulking and sealant',d:'Silicone caulk, plumber putty, thread tape',lo:8,hi:25,p:50,syn:['caulk','silicone','plumber putty','teflon tape']},

// ── ELECTRICIAN (85 items) ──
{t:'Electrician',c:'Services',n:'Electrical diagnostic / service call',d:'First-hour assessment, isolate issue, confirm scope',lo:135,hi:195,p:100,syn:['service call','diagnostic','electrical assessment','troubleshoot']},
{t:'Electrician',c:'Services',n:'Electrical inspection',d:'Safety inspection of panel, wiring, outlets',lo:145,hi:320,p:75,syn:['inspection','safety inspection','panel inspection']},
{t:'Electrician',c:'Services',n:'Electrical permit',d:'Municipal permit for electrical work requiring inspection',lo:80,hi:250,p:70,syn:['permit','electrical permit','ESA']},
{t:'Electrician',c:'Services',n:'Disposal and cleanup',d:'Remove old fixtures, clean work area',lo:35,hi:95,p:55,syn:['disposal','cleanup','remove old']},
{t:'Electrician',c:'Labour',n:'Install standard outlet',d:'Install new 15A or 20A duplex receptacle',lo:95,hi:195,p:95,syn:['outlet','receptacle','plug','wall outlet']},
{t:'Electrician',c:'Labour',n:'Install GFCI outlet',d:'Install ground fault circuit interrupter outlet',lo:115,hi:220,p:92,syn:['gfci','gfi','ground fault','bathroom outlet']},
{t:'Electrician',c:'Labour',n:'Install 240V outlet',d:'Install dedicated 240V outlet for dryer, range, or equipment',lo:195,hi:450,p:85,syn:['240v','dryer outlet','range outlet','welder outlet']},
{t:'Electrician',c:'Labour',n:'Install light switch',d:'Install or replace single-pole or 3-way switch',lo:85,hi:165,p:93,syn:['light switch','switch','dimmer','3-way switch']},
{t:'Electrician',c:'Labour',n:'Install dimmer switch',d:'Replace standard switch with dimmer',lo:95,hi:185,p:80,syn:['dimmer','dimmer switch','smart dimmer']},
{t:'Electrician',c:'Labour',n:'Install ceiling light fixture',d:'Mount and wire ceiling light or flush mount',lo:110,hi:250,p:90,syn:['ceiling light','light fixture','flush mount','fixture install']},
{t:'Electrician',c:'Labour',n:'Install pot lights / recessed lighting',d:'Cut hole, wire, and install recessed LED pot light',lo:95,hi:180,p:88,syn:['pot light','recessed light','can light','led pot light']},
{t:'Electrician',c:'Labour',n:'Install pendant light',d:'Mount and wire pendant or island lighting',lo:120,hi:280,p:78,syn:['pendant','pendant light','island light','hanging light']},
{t:'Electrician',c:'Labour',n:'Install under-cabinet lighting',d:'Mount and wire LED strip or puck lights under cabinets',lo:150,hi:350,p:65,syn:['under cabinet','puck lights','led strip','cabinet lighting']},
{t:'Electrician',c:'Labour',n:'Install ceiling fan',d:'Install and wire ceiling fan with light kit',lo:145,hi:320,p:82,syn:['ceiling fan','fan install','fan with light']},
{t:'Electrician',c:'Labour',n:'Install bathroom exhaust fan',d:'Install or replace bathroom ventilation fan',lo:165,hi:350,p:80,syn:['exhaust fan','bathroom fan','vent fan']},
{t:'Electrician',c:'Labour',n:'Install EV charger outlet',d:'Install dedicated 240V/50A circuit and outlet for EV charging',lo:380,hi:780,p:85,syn:['ev charger','electric vehicle','charging station','level 2']},
{t:'Electrician',c:'Labour',n:'Panel upgrade — 100A to 200A',d:'Replace electrical panel and main breaker, reconnect circuits',lo:2200,hi:4200,p:75,syn:['panel upgrade','200 amp','panel replacement','service upgrade']},
{t:'Electrician',c:'Labour',n:'Replace electrical panel',d:'Replace obsolete or damaged panel with new',lo:1800,hi:3500,p:70,syn:['panel replacement','breaker panel','fuse box upgrade']},
{t:'Electrician',c:'Labour',n:'New circuit run',d:'Run new dedicated circuit from panel to destination',lo:280,hi:650,p:88,syn:['new circuit','dedicated circuit','circuit run','home run']},
{t:'Electrician',c:'Labour',n:'Circuit tracing / troubleshoot',d:'Trace and identify circuit issues, shorts, or open faults',lo:145,hi:320,p:82,syn:['troubleshoot','circuit trace','fault finding','short circuit']},
{t:'Electrician',c:'Labour',n:'Install whole-home surge protector',d:'Install surge protection at electrical panel',lo:195,hi:380,p:60,syn:['surge protector','whole home surge','panel surge']},
{t:'Electrician',c:'Labour',n:'Install AFCI breaker',d:'Install arc fault circuit interrupter breaker',lo:145,hi:280,p:55,syn:['afci','arc fault','afci breaker']},
{t:'Electrician',c:'Labour',n:'Install outdoor outlet',d:'Install weatherproof outlet on exterior wall',lo:165,hi:320,p:72,syn:['outdoor outlet','exterior outlet','weatherproof outlet']},
{t:'Electrician',c:'Labour',n:'Install outdoor lighting',d:'Mount and wire exterior sconce, soffit, or landscape lights',lo:120,hi:280,p:70,syn:['outdoor light','exterior light','porch light','soffit light']},
{t:'Electrician',c:'Labour',n:'Install smart doorbell',d:'Mount and wire video doorbell with transformer',lo:95,hi:220,p:65,syn:['doorbell','smart doorbell','ring','video doorbell']},
{t:'Electrician',c:'Labour',n:'Install smoke / CO detector',d:'Install hardwired smoke or carbon monoxide detector',lo:85,hi:165,p:78,syn:['smoke detector','co detector','smoke alarm','carbon monoxide']},
{t:'Electrician',c:'Labour',n:'Replace smoke detectors — full home',d:'Replace all hardwired smoke/CO detectors to current code',lo:280,hi:650,p:65,syn:['smoke detectors','full home','detector replacement']},
{t:'Electrician',c:'Labour',n:'Install generator transfer switch',d:'Install manual or automatic transfer switch for backup power',lo:450,hi:1200,p:50,syn:['transfer switch','generator','backup power']},
{t:'Electrician',c:'Labour',n:'Install data / ethernet run',d:'Run CAT6 cable from panel to outlet location',lo:120,hi:280,p:50,syn:['ethernet','data cable','cat6','network cable']},
{t:'Electrician',c:'Labour',n:'Install baseboard heater',d:'Mount and wire electric baseboard heater',lo:195,hi:380,p:55,syn:['baseboard heater','electric heat','baseboard']},
{t:'Electrician',c:'Labour',n:'Install heated floor thermostat',d:'Wire thermostat for in-floor heating system',lo:145,hi:280,p:45,syn:['floor heat','heated floor','in floor heating','thermostat']},
{t:'Electrician',c:'Labour',n:'Aluminum wiring remediation',d:'Pigtail connections or rewire aluminum to copper',lo:65,hi:120,p:55,syn:['aluminum wiring','pigtail','aluminium','copalum']},
{t:'Electrician',c:'Labour',n:'Replace breaker',d:'Replace failed or tripping breaker',lo:95,hi:220,p:78,syn:['breaker','replace breaker','tripping breaker']},
{t:'Electrician',c:'Labour',n:'Replace outlet',d:'Replace damaged or outdated outlet',lo:75,hi:145,p:80,syn:['replace outlet','swap outlet','old outlet']},
{t:'Electrician',c:'Labour',n:'Replace light switch',d:'Replace damaged or outdated switch',lo:75,hi:145,p:80,syn:['replace switch','swap switch','old switch']},
{t:'Electrician',c:'Labour',n:'Repair light fixture',d:'Diagnose and fix non-working light or flickering',lo:95,hi:220,p:75,syn:['fixture repair','flickering','not working','light repair']},
{t:'Electrician',c:'Labour',n:'Install kitchen island circuit',d:'Run dedicated circuit for island outlets or pendants',lo:280,hi:550,p:60,syn:['island circuit','kitchen island','island outlet']},
{t:'Electrician',c:'Labour',n:'Electrical rough-in',d:'Wire new circuits during renovation before drywall',lo:350,hi:1200,p:55,syn:['rough in','rough-in','new construction','pre-wire']},
{t:'Electrician',c:'Materials',n:'Wire and cable',d:'14/2, 12/2, or 10/3 Romex, conduit, boxes',lo:25,hi:150,p:65,syn:['wire','romex','cable','electrical wire','wiring','rewire','circuit','damaged wiring','replace wiring','new wiring']},
{t:'Electrician',c:'Materials',n:'Panel and breakers',d:'Panel, main breaker, branch breakers',lo:250,hi:800,p:55,syn:['panel','breakers','electrical panel','breaker box']},
{t:'Electrician',c:'Materials',n:'Outlets and switches',d:'Receptacles, switches, cover plates, boxes',lo:10,hi:60,p:60,syn:['outlets','switches','cover plates','device']},
{t:'Electrician',c:'Materials',n:'Light fixtures and bulbs',d:'Fixtures, LED bulbs, mounting hardware',lo:25,hi:200,p:58,syn:['fixtures','bulbs','led','light fixture']},

// ── HVAC (80 items) ──
{t:'HVAC',c:'Services',n:'HVAC diagnostic / service call',d:'First-hour assessment of heating or cooling issue',lo:135,hi:195,p:100,syn:['service call','diagnostic','hvac assessment','no heat','no cool']},
{t:'HVAC',c:'Services',n:'Furnace tune-up',d:'Annual furnace maintenance — clean, inspect, test safety',lo:120,hi:220,p:85,syn:['tune up','maintenance','annual service','furnace service']},
{t:'HVAC',c:'Services',n:'AC tune-up',d:'Annual AC maintenance — clean coils, check charge, test',lo:120,hi:220,p:82,syn:['ac tune up','ac maintenance','air conditioner service']},
{t:'HVAC',c:'Services',n:'HVAC permit',d:'Municipal permit for HVAC equipment installation',lo:80,hi:250,p:65,syn:['permit','hvac permit','mechanical permit']},
{t:'HVAC',c:'Services',n:'Duct cleaning',d:'Clean supply and return ductwork throughout home',lo:280,hi:550,p:60,syn:['duct cleaning','air duct','vent cleaning']},
{t:'HVAC',c:'Services',n:'Disposal — old equipment',d:'Disconnect and haul away old furnace, AC, or tank',lo:95,hi:250,p:55,syn:['disposal','haul away','remove old','equipment removal']},
{t:'HVAC',c:'Labour',n:'Install furnace',d:'Remove old, install new high-efficiency furnace',lo:1800,hi:4500,p:95,syn:['furnace install','furnace replacement','new furnace']},
{t:'HVAC',c:'Labour',n:'Install central AC',d:'Install outdoor condenser, indoor coil, refrigerant lines',lo:2500,hi:5500,p:90,syn:['ac install','central air','air conditioner','air conditioning']},
{t:'HVAC',c:'Labour',n:'Install heat pump',d:'Install air-source heat pump with indoor and outdoor units',lo:3500,hi:8000,p:80,syn:['heat pump','air source','mini split','ductless']},
{t:'HVAC',c:'Labour',n:'Install mini-split',d:'Mount indoor head, outdoor unit, and refrigerant lines',lo:2200,hi:4500,p:78,syn:['mini split','ductless','wall mount','mitsubishi']},
{t:'HVAC',c:'Labour',n:'Install thermostat',d:'Install and program smart or programmable thermostat',lo:95,hi:220,p:85,syn:['thermostat','smart thermostat','nest','ecobee']},
{t:'HVAC',c:'Labour',n:'Install humidifier',d:'Mount and plumb whole-home humidifier on furnace',lo:250,hi:550,p:60,syn:['humidifier','whole home humidifier','bypass humidifier']},
{t:'HVAC',c:'Labour',n:'Install HRV / ERV',d:'Install heat or energy recovery ventilator',lo:1200,hi:2800,p:55,syn:['hrv','erv','heat recovery','ventilator']},
{t:'HVAC',c:'Labour',n:'Install air purifier',d:'Install whole-home air purification on furnace',lo:350,hi:850,p:50,syn:['air purifier','uv light','hepa filter','air cleaner']},
{t:'HVAC',c:'Labour',n:'Install zone dampers',d:'Add motorized dampers for zone temperature control',lo:350,hi:800,p:45,syn:['zone damper','zoning','zone control']},
{t:'HVAC',c:'Labour',n:'Install gas fireplace',d:'Install direct-vent gas fireplace insert or unit',lo:1200,hi:3500,p:50,syn:['gas fireplace','fireplace insert','direct vent']},
{t:'HVAC',c:'Labour',n:'Repair furnace ignitor',d:'Replace failed hot surface ignitor',lo:145,hi:280,p:85,syn:['ignitor','igniter','no heat','wont light']},
{t:'HVAC',c:'Labour',n:'Repair furnace blower motor',d:'Replace failed blower motor or capacitor',lo:280,hi:550,p:78,syn:['blower motor','fan motor','no air','weak airflow']},
{t:'HVAC',c:'Labour',n:'Repair furnace circuit board',d:'Diagnose and replace failed control board',lo:320,hi:650,p:70,syn:['circuit board','control board','error code']},
{t:'HVAC',c:'Labour',n:'Repair AC compressor',d:'Diagnose and replace failed compressor',lo:800,hi:2200,p:60,syn:['compressor','ac compressor','not cooling']},
{t:'HVAC',c:'Labour',n:'Repair AC capacitor',d:'Replace failed run or start capacitor',lo:145,hi:280,p:80,syn:['capacitor','ac not starting','humming']},
{t:'HVAC',c:'Labour',n:'AC refrigerant recharge',d:'Test, find leak if needed, recharge refrigerant',lo:195,hi:450,p:75,syn:['recharge','refrigerant','freon','r410a','low charge']},
{t:'HVAC',c:'Labour',n:'Replace pressure switch',d:'Replace furnace pressure switch',lo:120,hi:250,p:72,syn:['pressure switch','pressure fault','flashing light']},
{t:'HVAC',c:'Labour',n:'Replace gas valve',d:'Replace furnace gas valve assembly',lo:280,hi:550,p:65,syn:['gas valve','no gas','valve replacement']},
{t:'HVAC',c:'Labour',n:'Replace thermostat wire',d:'Run new thermostat cable from unit to thermostat',lo:145,hi:320,p:55,syn:['thermostat wire','c-wire','cable run']},
{t:'HVAC',c:'Labour',n:'Replace condensate pump/drain',d:'Replace AC condensate pump or clear blocked drain',lo:120,hi:280,p:60,syn:['condensate','drain','ac leaking water','condensate pump']},
{t:'HVAC',c:'Labour',n:'Ductwork modification',d:'Add, extend, or reroute HVAC ductwork',lo:250,hi:650,p:55,syn:['ductwork','duct run','extend duct','new vent']},
{t:'HVAC',c:'Labour',n:'Replace furnace filter rack',d:'Install new filter rack or upgrade to 4-inch slot',lo:95,hi:220,p:50,syn:['filter rack','filter slot','4 inch filter']},
{t:'HVAC',c:'Labour',n:'Boiler service',d:'Annual boiler maintenance and safety inspection',lo:195,hi:380,p:50,syn:['boiler','boiler service','boiler maintenance']},
{t:'HVAC',c:'Labour',n:'Fireplace service',d:'Annual gas fireplace maintenance and pilot check',lo:145,hi:280,p:48,syn:['fireplace service','pilot light','fireplace maintenance']},
{t:'HVAC',c:'Materials',n:'Furnace — mid-efficiency',d:'Mid-efficiency gas furnace unit',lo:800,hi:1800,p:55,syn:['furnace unit','gas furnace','mid efficiency']},
{t:'HVAC',c:'Materials',n:'Furnace — high-efficiency',d:'96%+ AFUE high-efficiency condensing furnace',lo:1200,hi:2800,p:60,syn:['high efficiency','condensing furnace','96 afue']},
{t:'HVAC',c:'Materials',n:'AC condenser unit',d:'Outdoor air conditioning condenser',lo:1200,hi:3000,p:55,syn:['condenser','ac unit','outdoor unit']},
{t:'HVAC',c:'Materials',n:'Thermostat unit',d:'Smart or programmable thermostat',lo:35,hi:350,p:65,syn:['thermostat','nest','ecobee','honeywell']},
{t:'HVAC',c:'Materials',n:'Refrigerant lines',d:'Copper lineset for AC or heat pump',lo:80,hi:250,p:50,syn:['lineset','refrigerant lines','copper line']},

// ── CARPENTER (75 items) ──
{t:'Carpenter',c:'Services',n:'Carpentry assessment',d:'Site assessment for trim, framing, or custom work',lo:95,hi:165,p:90,syn:['assessment','consultation','site visit']},
{t:'Carpenter',c:'Services',n:'Building permit',d:'Permit for structural or framing work',lo:80,hi:350,p:60,syn:['permit','building permit','structural permit']},
{t:'Carpenter',c:'Labour',n:'Install baseboard trim',d:'Measure, cut, and install baseboard moulding',lo:3,hi:7,p:95,syn:['baseboard','base moulding','baseboards']},
{t:'Carpenter',c:'Labour',n:'Install door casing / trim',d:'Install casing around interior door frame',lo:85,hi:195,p:92,syn:['door casing','door trim','casing','architrave']},
{t:'Carpenter',c:'Labour',n:'Install crown moulding',d:'Measure, cut, and install crown moulding',lo:5,hi:12,p:78,syn:['crown','crown moulding','cornice','ceiling trim']},
{t:'Carpenter',c:'Labour',n:'Install interior door',d:'Hang pre-hung or slab door in existing frame',lo:195,hi:380,p:88,syn:['interior door','door install','bedroom door','prehung door']},
{t:'Carpenter',c:'Labour',n:'Install exterior door',d:'Remove old, install new exterior door with weatherstrip',lo:350,hi:750,p:80,syn:['exterior door','entry door','front door','steel door']},
{t:'Carpenter',c:'Labour',n:'Install sliding closet doors',d:'Install bypass or bi-fold closet doors with track',lo:195,hi:420,p:72,syn:['closet doors','bypass doors','bi-fold','bifold']},
{t:'Carpenter',c:'Labour',n:'Install barn door',d:'Mount barn door hardware and hang door',lo:250,hi:480,p:60,syn:['barn door','sliding door','barn door hardware']},
{t:'Carpenter',c:'Labour',n:'Install pocket door',d:'Frame and install pocket door in wall cavity',lo:450,hi:950,p:50,syn:['pocket door','sliding pocket','disappearing door']},
{t:'Carpenter',c:'Labour',n:'Install shelving',d:'Build and mount custom or adjustable shelving',lo:145,hi:380,p:75,syn:['shelving','shelves','closet shelves','custom shelves']},
{t:'Carpenter',c:'Labour',n:'Install closet organizer',d:'Build and install closet organization system',lo:350,hi:850,p:55,syn:['closet organizer','closet system','wardrobe']},
{t:'Carpenter',c:'Labour',n:'Build deck',d:'Frame and deck new outdoor deck structure',lo:25,hi:55,p:70,syn:['deck','build deck','new deck','deck construction']},
{t:'Carpenter',c:'Labour',n:'Deck repair',d:'Replace damaged boards, tighten structure, seal',lo:195,hi:650,p:72,syn:['deck repair','rotten boards','deck fix']},
{t:'Carpenter',c:'Labour',n:'Build fence',d:'Install fence posts, rails, and pickets',lo:25,hi:50,p:68,syn:['fence','build fence','new fence','fence install']},
{t:'Carpenter',c:'Labour',n:'Fence repair',d:'Replace broken boards, reset posts, patch sections',lo:145,hi:420,p:70,syn:['fence repair','broken fence','fence fix']},
{t:'Carpenter',c:'Labour',n:'Install railing / handrail',d:'Mount stair or deck railing to code',lo:195,hi:550,p:65,syn:['railing','handrail','stair rail','deck railing']},
{t:'Carpenter',c:'Labour',n:'Frame basement wall',d:'Frame stud wall for basement finishing',lo:3,hi:6,p:65,syn:['framing','basement framing','stud wall','frame wall']},
{t:'Carpenter',c:'Labour',n:'Install drywall',d:'Hang, tape, and mud drywall sheets',lo:2,hi:5,p:68,syn:['drywall','gyproc','sheetrock','drywall install']},
{t:'Carpenter',c:'Labour',n:'Drywall patch / repair',d:'Patch holes, skim coat, sand smooth',lo:85,hi:250,p:78,syn:['drywall repair','patch','hole repair','skim coat']},
{t:'Carpenter',c:'Labour',n:'Install window',d:'Remove old window, install new, trim and seal',lo:350,hi:750,p:60,syn:['window install','window replacement','new window']},
{t:'Carpenter',c:'Labour',n:'Install laminate flooring',d:'Lay laminate with underlay, transitions, and trim',lo:3,hi:7,p:72,syn:['laminate','laminate flooring','floating floor']},
{t:'Carpenter',c:'Labour',n:'Install hardwood flooring',d:'Lay and nail hardwood flooring',lo:5,hi:12,p:65,syn:['hardwood','hardwood floor','oak floor','wood floor']},
{t:'Carpenter',c:'Labour',n:'Install vinyl plank flooring',d:'Lay click-lock or glue-down luxury vinyl plank',lo:3,hi:7,p:75,syn:['vinyl plank','lvp','luxury vinyl','vinyl flooring']},
{t:'Carpenter',c:'Labour',n:'Install tile flooring',d:'Lay floor tile with mortar, grout, and seal',lo:8,hi:18,p:60,syn:['tile','floor tile','ceramic tile','porcelain tile']},
{t:'Carpenter',c:'Labour',n:'Install stair treads',d:'Replace or install stair treads and risers',lo:65,hi:150,p:58,syn:['stair treads','stairs','risers','staircase']},
{t:'Carpenter',c:'Labour',n:'Install wainscoting',d:'Install wainscot panelling on wall',lo:8,hi:18,p:50,syn:['wainscoting','wainscot','panel','wall panelling']},
{t:'Carpenter',c:'Labour',n:'Door adjustment / repair',d:'Plane, adjust hinges, fix latch on sticking door',lo:75,hi:165,p:80,syn:['door adjustment','sticking door','door repair','door plane']},
{t:'Carpenter',c:'Labour',n:'Subfloor repair',d:'Replace damaged or rotted subfloor section',lo:195,hi:480,p:55,syn:['subfloor','floor repair','rotten floor','plywood']},
{t:'Carpenter',c:'Labour',n:'TV mounting',d:'Mount TV on wall with concealed wiring',lo:95,hi:220,p:65,syn:['tv mount','tv mounting','wall mount tv']},
{t:'Carpenter',c:'Materials',n:'Lumber and framing materials',d:'2x4, 2x6, plywood, screws, nails',lo:50,hi:500,p:55,syn:['lumber','framing','2x4','plywood','studs']},
{t:'Carpenter',c:'Materials',n:'Trim and moulding',d:'Baseboard, casing, crown moulding',lo:30,hi:200,p:60,syn:['trim','moulding','baseboard','casing']},
{t:'Carpenter',c:'Materials',n:'Flooring materials',d:'Laminate, hardwood, vinyl, or tile',lo:2,hi:15,p:58,syn:['flooring','laminate','hardwood','vinyl plank','tile']},
{t:'Carpenter',c:'Materials',n:'Door and hardware',d:'Interior or exterior door, hinges, handle set',lo:80,hi:450,p:55,syn:['door','hardware','handle','hinges','lockset']},

// ── ROOFING (65 items) ──
{t:'Roofing',c:'Services',n:'Roof inspection',d:'Ladder or drone inspection with condition report',lo:95,hi:220,p:100,syn:['roof inspection','assessment','condition report']},
{t:'Roofing',c:'Services',n:'Leak investigation',d:'Targeted investigation to locate roof leak source',lo:145,hi:320,p:88,syn:['leak investigation','find leak','leak detection']},
{t:'Roofing',c:'Services',n:'Roofing permit',d:'Municipal permit for re-roof or major repair',lo:80,hi:300,p:60,syn:['permit','roofing permit','building permit']},
{t:'Roofing',c:'Services',n:'Safety and access setup',d:'Ladder, harness, roof access, and site prep',lo:85,hi:220,p:95,syn:['safety','access','ladder','harness']},
{t:'Roofing',c:'Services',n:'Disposal — roofing debris',d:'Dumpster and debris removal from tear-off',lo:250,hi:650,p:70,syn:['disposal','dumpster','debris','tear off removal']},
{t:'Roofing',c:'Labour',n:'Shingle repair — small area',d:'Replace damaged shingles in localized area',lo:195,hi:450,p:92,syn:['shingle repair','patch','missing shingles','storm damage']},
{t:'Roofing',c:'Labour',n:'Shingle repair — ridge/hip',d:'Replace ridge cap or hip shingles',lo:195,hi:420,p:80,syn:['ridge cap','hip shingles','ridge repair']},
{t:'Roofing',c:'Labour',n:'Full re-roof — asphalt shingles',d:'Tear off old, install new asphalt shingles, complete',lo:4500,hi:12000,p:85,syn:['re-roof','reroof','new roof','shingle roof','roof replacement']},
{t:'Roofing',c:'Labour',n:'Full re-roof — metal',d:'Install standing seam or metal panel roof',lo:8000,hi:20000,p:55,syn:['metal roof','standing seam','metal panel']},
{t:'Roofing',c:'Labour',n:'Flat roof repair',d:'Patch or seal flat roof membrane leak',lo:250,hi:650,p:75,syn:['flat roof','membrane','epdm','tpo','modified bitumen']},
{t:'Roofing',c:'Labour',n:'Flat roof replacement',d:'Remove and replace flat roof membrane system',lo:12,hi:25,p:55,syn:['flat roof replacement','membrane replacement']},
{t:'Roofing',c:'Labour',n:'Flashing repair',d:'Reseal or replace flashing at penetrations',lo:145,hi:380,p:85,syn:['flashing','step flashing','counter flashing','vent flashing']},
{t:'Roofing',c:'Labour',n:'Chimney flashing',d:'Install or repair chimney counter and step flashing',lo:280,hi:650,p:72,syn:['chimney flashing','chimney leak','counter flashing']},
{t:'Roofing',c:'Labour',n:'Vent boot replacement',d:'Replace cracked rubber boot around roof penetration',lo:120,hi:280,p:78,syn:['vent boot','pipe boot','plumbing vent','roof vent']},
{t:'Roofing',c:'Labour',n:'Skylight repair',d:'Reseal or replace skylight flashing',lo:250,hi:550,p:65,syn:['skylight','skylight leak','skylight repair']},
{t:'Roofing',c:'Labour',n:'Skylight install',d:'Cut opening, frame, flash, and install skylight',lo:750,hi:1800,p:50,syn:['skylight install','new skylight','sun tunnel']},
{t:'Roofing',c:'Labour',n:'Soffit and fascia repair',d:'Replace damaged soffit panels or fascia board',lo:195,hi:480,p:70,syn:['soffit','fascia','soffit repair','fascia board']},
{t:'Roofing',c:'Labour',n:'Gutter install',d:'Install new aluminum gutters and downspouts',lo:8,hi:15,p:72,syn:['gutters','gutter install','eavestrough','downspout']},
{t:'Roofing',c:'Labour',n:'Gutter repair',d:'Reseal joints, reattach, or patch gutters',lo:120,hi:320,p:75,syn:['gutter repair','leaking gutter','sagging gutter']},
{t:'Roofing',c:'Labour',n:'Gutter guard install',d:'Install gutter protection screens or guards',lo:5,hi:12,p:55,syn:['gutter guard','leaf guard','gutter screen']},
{t:'Roofing',c:'Labour',n:'Attic ventilation — ridge vent',d:'Cut and install ridge vent for attic airflow',lo:250,hi:550,p:60,syn:['ridge vent','attic vent','ventilation']},
{t:'Roofing',c:'Labour',n:'Attic ventilation — box vent',d:'Install roof box vent or turbine vent',lo:120,hi:280,p:55,syn:['box vent','turbine vent','roof vent']},
{t:'Roofing',c:'Labour',n:'Ice dam repair',d:'Remove ice dam and repair damage underneath',lo:350,hi:850,p:50,syn:['ice dam','ice removal','winter damage']},
{t:'Roofing',c:'Labour',n:'Attic insulation top-up',d:'Add blown-in insulation to attic floor',lo:1,hi:3,p:55,syn:['insulation','attic insulation','blown in','r-value']},
{t:'Roofing',c:'Labour',n:'Decking / sheathing repair',d:'Replace rotted roof sheathing discovered during tear-off',lo:3,hi:6,p:68,syn:['sheathing','decking','plywood','osb','rotten']},
{t:'Roofing',c:'Labour',n:'Emergency tarp / temp repair',d:'Install temporary tarp or patch to stop active leak',lo:195,hi:450,p:80,syn:['emergency','tarp','temp repair','active leak']},
{t:'Roofing',c:'Materials',n:'Asphalt shingles — standard',d:'Architectural asphalt shingles per square',lo:85,hi:140,p:60,syn:['shingles','asphalt','architectural shingle']},
{t:'Roofing',c:'Materials',n:'Underlayment and ice shield',d:'Synthetic underlayment, ice and water shield',lo:35,hi:80,p:55,syn:['underlayment','ice shield','felt','synthetic']},
{t:'Roofing',c:'Materials',n:'Flashing materials',d:'Step flashing, drip edge, counter flashing',lo:25,hi:120,p:55,syn:['flashing','drip edge','step flashing']},

// ── PAINTER (60 items) ──
{t:'Painter',c:'Services',n:'Paint consultation',d:'Colour selection, scope review, surface assessment',lo:0,hi:95,p:85,syn:['consultation','colour','color','assessment']},
{t:'Painter',c:'Services',n:'Furniture / floor protection',d:'Mask, tape, cover floors and furniture',lo:45,hi:120,p:80,syn:['protection','masking','drop cloth','taping']},
{t:'Painter',c:'Services',n:'Paint disposal and cleanup',d:'Remove paint cans, clean brushes, final walkthrough',lo:35,hi:95,p:70,syn:['cleanup','disposal','final cleanup']},
{t:'Painter',c:'Labour',n:'Paint room — walls only',d:'Prep, prime if needed, two coats on walls',lo:250,hi:550,p:98,syn:['paint room','wall paint','interior paint','room paint']},
{t:'Painter',c:'Labour',n:'Paint room — walls + ceiling',d:'Prep, prime if needed, two coats walls and ceiling',lo:350,hi:750,p:95,syn:['walls and ceiling','full room','ceiling paint']},
{t:'Painter',c:'Labour',n:'Paint trim — per room',d:'Sand, prime, paint baseboard and door trim',lo:120,hi:280,p:85,syn:['trim paint','baseboard paint','casing paint']},
{t:'Painter',c:'Labour',n:'Paint door',d:'Prep, prime, and paint single interior or exterior door',lo:95,hi:220,p:80,syn:['door paint','paint door','door refinish']},
{t:'Painter',c:'Labour',n:'Paint cabinets',d:'Sand, prime, spray or roll kitchen cabinets',lo:1500,hi:4500,p:75,syn:['cabinet paint','kitchen cabinets','cabinet refinish','cabinet spray']},
{t:'Painter',c:'Labour',n:'Paint exterior — house',d:'Prep, scrape, prime, two coats exterior walls',lo:3500,hi:9000,p:70,syn:['exterior paint','house paint','outside paint','siding paint']},
{t:'Painter',c:'Labour',n:'Paint exterior — trim only',d:'Scrape, prime, paint exterior trim and fascia',lo:750,hi:2200,p:72,syn:['exterior trim','fascia paint','soffit paint']},
{t:'Painter',c:'Labour',n:'Stain deck',d:'Clean, sand, apply deck stain or sealer',lo:450,hi:1200,p:65,syn:['deck stain','deck seal','deck refinish']},
{t:'Painter',c:'Labour',n:'Stain fence',d:'Clean and apply fence stain or preservative',lo:350,hi:950,p:60,syn:['fence stain','fence seal','fence treatment']},
{t:'Painter',c:'Labour',n:'Patch and repair drywall',d:'Fill holes, sand smooth, prime patches',lo:45,hi:120,p:88,syn:['drywall patch','hole repair','nail holes','skim coat']},
{t:'Painter',c:'Labour',n:'Wallpaper removal',d:'Strip wallpaper, clean adhesive, prep for paint',lo:3,hi:8,p:60,syn:['wallpaper removal','strip wallpaper','wallpaper strip']},
{t:'Painter',c:'Labour',n:'Accent wall — special finish',d:'Apply textured, faux, or specialty paint finish',lo:250,hi:550,p:50,syn:['accent wall','feature wall','textured','faux finish']},
{t:'Painter',c:'Labour',n:'Ceiling repair and paint',d:'Patch water stains, prime, repaint ceiling',lo:195,hi:450,p:72,syn:['ceiling repair','water stain','ceiling repaint']},
{t:'Painter',c:'Labour',n:'Stairwell paint',d:'Paint stairwell walls and ceiling — includes scaffolding',lo:350,hi:750,p:55,syn:['stairwell','staircase','tall walls']},
{t:'Painter',c:'Labour',n:'Paint garage',d:'Prep and paint garage walls and ceiling',lo:450,hi:950,p:50,syn:['garage paint','garage walls']},
{t:'Painter',c:'Labour',n:'Epoxy garage floor',d:'Prep, etch, and apply epoxy floor coating',lo:750,hi:1800,p:45,syn:['epoxy','garage floor','floor coating']},
{t:'Painter',c:'Materials',n:'Paint — interior',d:'Premium interior latex paint per gallon',lo:45,hi:85,p:65,syn:['interior paint','latex','benjamin moore','sherwin williams']},
{t:'Painter',c:'Materials',n:'Paint — exterior',d:'Premium exterior paint per gallon',lo:55,hi:95,p:60,syn:['exterior paint','outdoor paint']},
{t:'Painter',c:'Materials',n:'Primer',d:'Primer / sealer per gallon',lo:25,hi:55,p:58,syn:['primer','sealer','stain blocker','kilz']},
{t:'Painter',c:'Materials',n:'Stain and sealer',d:'Deck or fence stain per gallon',lo:35,hi:75,p:55,syn:['stain','deck stain','fence stain','sealer']},
{t:'Painter',c:'Materials',n:'Caulking and prep materials',d:'Caulk, filler, sandpaper, tape',lo:15,hi:55,p:55,syn:['caulk','filler','sandpaper','painters tape']},

// ── LANDSCAPING (65 items) ──
{t:'Landscaping',c:'Services',n:'Landscape consultation',d:'Site visit, design review, scope discussion',lo:0,hi:150,p:85,syn:['consultation','design','landscape design','site visit']},
{t:'Landscaping',c:'Services',n:'Landscape design plan',d:'Scaled design plan with plant list and hardscape layout',lo:350,hi:1200,p:50,syn:['design plan','landscape plan','blueprint']},
{t:'Landscaping',c:'Labour',n:'Spring cleanup',d:'Rake, prune, bed cleanup, first mow, edge beds',lo:195,hi:450,p:95,syn:['spring cleanup','spring clean','yard cleanup']},
{t:'Landscaping',c:'Labour',n:'Fall cleanup',d:'Leaf removal, bed prep, final mow, winterize',lo:195,hi:480,p:90,syn:['fall cleanup','leaf removal','fall clean']},
{t:'Landscaping',c:'Labour',n:'Lawn mowing — per visit',d:'Mow, trim, edge, blow off walks',lo:35,hi:85,p:88,syn:['mowing','lawn mow','grass cutting','lawn maintenance']},
{t:'Landscaping',c:'Labour',n:'Sod installation',d:'Prep soil, lay sod, roll, and water',lo:2,hi:5,p:80,syn:['sod','new lawn','sod install','turf']},
{t:'Landscaping',c:'Labour',n:'Overseed and top-dress',d:'Aerate, overseed, and top-dress with compost',lo:0.15,hi:0.35,p:65,syn:['overseed','aerate','top dress','lawn repair']},
{t:'Landscaping',c:'Labour',n:'Garden bed creation',d:'Edge, excavate, amend soil, mulch new bed',lo:8,hi:18,p:78,syn:['garden bed','flower bed','bed creation','new bed']},
{t:'Landscaping',c:'Labour',n:'Mulch — install',d:'Spread mulch in garden beds',lo:75,hi:120,p:82,syn:['mulch','mulching','wood chips','bark mulch']},
{t:'Landscaping',c:'Labour',n:'Tree planting',d:'Dig hole, plant tree, stake, and water',lo:120,hi:350,p:70,syn:['tree planting','plant tree','new tree']},
{t:'Landscaping',c:'Labour',n:'Shrub planting',d:'Plant shrubs with amended soil and mulch',lo:45,hi:120,p:72,syn:['shrub planting','plant shrub','bush']},
{t:'Landscaping',c:'Labour',n:'Tree pruning — small/medium',d:'Prune and shape trees accessible from ground or ladder',lo:150,hi:450,p:75,syn:['tree pruning','tree trim','prune']},
{t:'Landscaping',c:'Labour',n:'Tree removal — small',d:'Fell, section, and remove small tree',lo:350,hi:850,p:60,syn:['tree removal','remove tree','cut tree']},
{t:'Landscaping',c:'Labour',n:'Stump grinding',d:'Grind stump below grade and fill',lo:150,hi:350,p:55,syn:['stump grinding','stump removal','grind stump']},
{t:'Landscaping',c:'Labour',n:'Hedge trimming',d:'Shape and trim hedges and border shrubs',lo:120,hi:320,p:78,syn:['hedge','hedge trimming','hedge cutting','shrub trim']},
{t:'Landscaping',c:'Labour',n:'Patio — paver install',d:'Excavate, base, sand, lay pavers, edge restraint',lo:18,hi:35,p:70,syn:['patio','pavers','paver patio','interlock']},
{t:'Landscaping',c:'Labour',n:'Walkway — paver install',d:'Install paver walkway with proper base',lo:18,hi:35,p:68,syn:['walkway','path','paver walkway','garden path']},
{t:'Landscaping',c:'Labour',n:'Retaining wall — small',d:'Build landscape block retaining wall under 3 feet',lo:25,hi:50,p:60,syn:['retaining wall','garden wall','landscape block']},
{t:'Landscaping',c:'Labour',n:'French drain install',d:'Excavate trench, lay perforated pipe, gravel backfill',lo:25,hi:50,p:55,syn:['french drain','drainage','perforated pipe','yard drainage']},
{t:'Landscaping',c:'Labour',n:'Irrigation system install',d:'Design and install drip or spray irrigation',lo:1500,hi:4500,p:50,syn:['irrigation','sprinkler','drip system','watering system']},
{t:'Landscaping',c:'Labour',n:'Irrigation blowout — winterize',d:'Compressed air blowout to prevent freeze damage',lo:75,hi:150,p:65,syn:['blowout','winterize irrigation','sprinkler winterize']},
{t:'Landscaping',c:'Labour',n:'Irrigation spring startup',d:'Open valves, test zones, adjust heads',lo:75,hi:150,p:62,syn:['spring startup','irrigation startup','sprinkler startup']},
{t:'Landscaping',c:'Labour',n:'Fence install — wood',d:'Install wood fence with posts, rails, and boards',lo:30,hi:55,p:65,syn:['fence','wood fence','privacy fence','fence install']},
{t:'Landscaping',c:'Labour',n:'Grading and leveling',d:'Regrade yard for drainage or prep for sod/patio',lo:500,hi:2000,p:55,syn:['grading','leveling','regrade','slope']},
{t:'Landscaping',c:'Labour',n:'Landscape lighting install',d:'Install low-voltage path and accent lighting',lo:150,hi:350,p:50,syn:['landscape lighting','path lights','garden lights','low voltage']},
{t:'Landscaping',c:'Labour',n:'Raised garden bed',d:'Build raised planter bed from cedar or block',lo:195,hi:480,p:55,syn:['raised bed','planter','garden box','vegetable garden']},
{t:'Landscaping',c:'Materials',n:'Mulch — bulk',d:'Bulk mulch per cubic yard delivered',lo:45,hi:85,p:60,syn:['mulch','bulk mulch','wood chips']},
{t:'Landscaping',c:'Materials',n:'Topsoil — bulk',d:'Screened topsoil per cubic yard delivered',lo:35,hi:65,p:55,syn:['topsoil','soil','screened soil']},
{t:'Landscaping',c:'Materials',n:'Paver stones',d:'Interlocking pavers per square foot',lo:4,hi:12,p:55,syn:['pavers','paver stone','interlock','patio stone']},
{t:'Landscaping',c:'Materials',n:'Sod rolls',d:'Kentucky bluegrass or fescue sod per sq ft',lo:0.45,hi:0.85,p:55,syn:['sod','turf','grass rolls']},
{t:'Landscaping',c:'Materials',n:'Plants and shrubs',d:'Nursery stock — shrubs, perennials, annuals',lo:15,hi:120,p:55,syn:['plants','shrubs','perennials','annuals','nursery']},

// ── GENERAL CONTRACTOR (55 items) ──
{t:'General Contractor',c:'Services',n:'Project assessment',d:'Site visit, scope review, and estimate preparation',lo:0,hi:195,p:95,syn:['assessment','consultation','site visit','estimate']},
{t:'General Contractor',c:'Services',n:'Building permit',d:'Obtain municipal permits for renovation work',lo:150,hi:500,p:70,syn:['permit','building permit','city permit']},
{t:'General Contractor',c:'Services',n:'Trade coordination',d:'Schedule and manage subcontractor trades',lo:150,hi:350,p:60,syn:['coordination','sub coordination','trade management']},
{t:'General Contractor',c:'Services',n:'Site protection',d:'Floor covering, wall protection, dust barriers',lo:120,hi:350,p:65,syn:['protection','dust barrier','floor protection']},
{t:'General Contractor',c:'Services',n:'Demolition and debris removal',d:'Demo existing materials and haul to dump',lo:250,hi:850,p:75,syn:['demolition','demo','tear out','debris removal','dump run']},
{t:'General Contractor',c:'Labour',n:'Frame interior wall',d:'Build and erect stud wall partition — typical 8-12ft wall',lo:350,hi:950,p:85,syn:['framing','frame wall','partition','stud wall']},
{t:'General Contractor',c:'Labour',n:'Install drywall — hang and finish',d:'Hang, tape, mud, and sand drywall — typical room',lo:600,hi:2000,p:82,syn:['drywall','gyproc','sheetrock','drywall finish']},
{t:'General Contractor',c:'Labour',n:'Install insulation — batt',d:'Install fiberglass batt insulation — typical room or basement',lo:350,hi:1200,p:65,syn:['insulation','batt','fiberglass','r-value']},
{t:'General Contractor',c:'Labour',n:'Install flooring — general',d:'Install chosen flooring material with transitions — typical room',lo:450,hi:1800,p:72,syn:['flooring','floor install','flooring install']},
{t:'General Contractor',c:'Labour',n:'Install tile — floor or wall',d:'Set tile with mortar, grout, and seal — typical bathroom or kitchen',lo:800,hi:3000,p:68,syn:['tile','ceramic tile','porcelain','backsplash','floor tile']},
{t:'General Contractor',c:'Labour',n:'Install kitchen countertop',d:'Template, fabricate, and install countertop',lo:35,hi:85,p:65,syn:['countertop','counter','quartz','granite','laminate counter']},
{t:'General Contractor',c:'Labour',n:'Install kitchen cabinets',d:'Assemble and install upper and lower cabinets',lo:1500,hi:5000,p:60,syn:['cabinets','kitchen cabinets','cabinet install']},
{t:'General Contractor',c:'Labour',n:'Bathroom renovation — complete',d:'Full gut and rebuild of bathroom',lo:8000,hi:25000,p:55,syn:['bathroom reno','bathroom renovation','bathroom remodel']},
{t:'General Contractor',c:'Labour',n:'Kitchen renovation — complete',d:'Full kitchen renovation with cabinets, counters, flooring',lo:15000,hi:50000,p:50,syn:['kitchen reno','kitchen renovation','kitchen remodel']},
{t:'General Contractor',c:'Labour',n:'Basement finishing',d:'Frame, insulate, drywall, and finish basement — labour only',lo:8000,hi:25000,p:55,syn:['basement','basement finishing','basement development']},
{t:'General Contractor',c:'Labour',n:'Paint — per room',d:'Prep, prime, two coats walls and ceiling',lo:350,hi:750,p:78,syn:['paint','room paint','interior paint']},
{t:'General Contractor',c:'Labour',n:'Install interior door',d:'Hang pre-hung door, trim, and hardware',lo:250,hi:450,p:75,syn:['door','interior door','door install']},
{t:'General Contractor',c:'Labour',n:'Install window',d:'Remove old, install new window, trim and seal',lo:350,hi:750,p:60,syn:['window','window install','window replacement']},
{t:'General Contractor',c:'Labour',n:'Childproofing',d:'Install gates, outlet covers, cabinet locks, corner guards',lo:195,hi:450,p:40,syn:['childproof','baby proof','child safety','gates']},
{t:'General Contractor',c:'Labour',n:'Accessibility modifications',d:'Grab bars, ramps, lever handles, wider doors',lo:250,hi:850,p:45,syn:['accessibility','grab bar','ramp','aging in place']},
{t:'General Contractor',c:'Labour',n:'Furniture assembly',d:'Assemble flatpack furniture or shelving units',lo:65,hi:195,p:55,syn:['assembly','ikea','flatpack','furniture']},
{t:'General Contractor',c:'Labour',n:'Caulking — bathroom/kitchen',d:'Remove old caulk, clean, apply new silicone bead',lo:75,hi:165,p:70,syn:['caulking','recaulk','silicone','tub caulk']},
{t:'General Contractor',c:'Materials',n:'General materials allowance',d:'Screws, fasteners, adhesive, caulk, misc supplies',lo:25,hi:150,p:50,syn:['materials','supplies','fasteners','misc']},

// ── PLUMBER (17 new items) ──
{t:'Plumber',c:'Labour',n:'Reset toilet (wax ring)',d:'Pull toilet, replace wax ring and bolts, reset and test',lo:145,hi:265,p:80,syn:['reset toilet','wax ring replacement','toilet reset','reseat toilet']},
{t:'Plumber',c:'Labour',n:'Install bidet',d:'Install bidet seat or standalone bidet, connect water supply',lo:180,hi:420,p:55,syn:['bidet','bidet install','bidet seat','washlet']},
{t:'Plumber',c:'Labour',n:'Re-caulk tub/shower',d:'Remove old caulk, clean, apply new silicone around tub or shower',lo:95,hi:195,p:65,syn:['recaulk','caulk tub','caulk shower','silicone','tub caulk']},
{t:'Plumber',c:'Labour',n:'Clear sink clog',d:'Snake or auger kitchen or bathroom sink drain',lo:120,hi:250,p:88,syn:['sink clog','clogged sink','blocked sink','snake sink']},
{t:'Plumber',c:'Labour',n:'Clear toilet clog',d:'Auger or snake clogged toilet',lo:120,hi:280,p:86,syn:['toilet clog','clogged toilet','blocked toilet','plunge toilet']},
{t:'Plumber',c:'Labour',n:'Clear main line clog',d:'Snake or auger main sewer line from cleanout',lo:250,hi:550,p:84,syn:['main line clog','sewer clog','main drain','mainline blockage']},
{t:'Plumber',c:'Labour',n:'Hydro jetting',d:'High-pressure water jetting to clear severe drain blockage',lo:350,hi:800,p:70,syn:['hydro jet','jetting','pressure wash drain','water jet']},
{t:'Plumber',c:'Labour',n:'Replace anode rod',d:'Remove and replace sacrificial anode rod in water heater',lo:120,hi:250,p:60,syn:['anode rod','anode replacement','water heater rod','magnesium rod']},
{t:'Plumber',c:'Services',n:'Diagnose no hot water',d:'Troubleshoot water heater — check pilot, thermocouple, elements',lo:135,hi:250,p:82,syn:['no hot water','water heater diagnosis','cold water','no heat in tank']},
{t:'Plumber',c:'Labour',n:'Replace section of piping',d:'Cut out damaged section, replace with new pipe and fittings',lo:195,hi:550,p:72,syn:['pipe repair','pipe replacement','repipe section','replace pipe']},
{t:'Plumber',c:'Labour',n:'Install PRV (pressure reducing valve)',d:'Install pressure reducing valve on main water supply',lo:250,hi:480,p:58,syn:['prv','pressure reducing valve','pressure regulator','water pressure']},
{t:'Plumber',c:'Services',n:'Diagnose low water pressure',d:'Test pressure, check PRV, inspect for leaks or restrictions',lo:135,hi:250,p:65,syn:['low pressure','water pressure','weak flow','low flow']},
{t:'Plumber',c:'Labour',n:'Replace garburator',d:'Remove old garburator, install new unit, test',lo:185,hi:380,p:75,syn:['replace garburator','garburator swap','disposal replacement']},
{t:'Plumber',c:'Labour',n:'Unclog floor drain',d:'Snake or auger basement or utility room floor drain',lo:140,hi:300,p:72,syn:['floor drain clog','basement drain','blocked floor drain']},
{t:'Plumber',c:'Labour',n:'Disconnect gas appliance',d:'Safely disconnect and cap gas line to appliance',lo:95,hi:195,p:55,syn:['gas disconnect','cap gas line','disconnect stove','disconnect dryer']},
{t:'Plumber',c:'Labour',n:'Final fixture hookups',d:'Connect fixtures after renovation — sinks, toilets, faucets',lo:250,hi:650,p:68,syn:['fixture hookup','final connections','trim out','fixture install']},
{t:'Plumber',c:'Labour',n:'Pipe insulation install',d:'Insulate exposed water pipes to prevent freezing',lo:120,hi:350,p:52,syn:['pipe insulation','freeze protection','insulate pipes','pipe wrap']},

// ── ELECTRICIAN (28 new items) ──
{t:'Electrician',c:'Services',n:'Troubleshoot dead outlet',d:'Diagnose and repair outlet with no power',lo:120,hi:250,p:85,syn:['dead outlet','no power outlet','outlet not working','receptacle dead']},
{t:'Electrician',c:'Services',n:'Troubleshoot flickering lights',d:'Diagnose cause of flickering — loose connections, overload, or fixture issue',lo:120,hi:280,p:80,syn:['flickering lights','lights flicker','intermittent power','dimming lights']},
{t:'Electrician',c:'Labour',n:'Install subpanel',d:'Install secondary electrical sub-panel for garage, shop, or addition',lo:650,hi:1500,p:60,syn:['subpanel','sub panel','secondary panel','garage panel']},
{t:'Electrician',c:'Labour',n:'Rewire room',d:'Replace all wiring in a single room — outlets, switches, lights',lo:800,hi:2500,p:50,syn:['rewire room','room rewire','update wiring','room electrical']},
{t:'Electrician',c:'Labour',n:'Whole-home rewiring',d:'Complete rewire of house — new circuits, panel, devices',lo:8000,hi:25000,p:35,syn:['whole house rewire','full rewire','complete rewiring','house rewire']},
{t:'Electrician',c:'Labour',n:'Install range hood wiring',d:'Run dedicated circuit and install outlet for range hood',lo:180,hi:380,p:65,syn:['range hood wiring','hood circuit','kitchen hood electrical']},
{t:'Electrician',c:'Labour',n:'Install appliance wiring',d:'Run dedicated circuit for new appliance — dishwasher, microwave, etc.',lo:195,hi:420,p:70,syn:['appliance circuit','dedicated circuit','appliance wiring','new circuit for appliance']},
{t:'Electrician',c:'Labour',n:'Install hot tub wiring',d:'Run 240V circuit, GFCI disconnect, and connect hot tub',lo:650,hi:1400,p:55,syn:['hot tub wiring','spa wiring','hot tub electrical','spa circuit','jacuzzi']},
{t:'Electrician',c:'Labour',n:'Grounding system install',d:'Install or repair grounding rods and bonding connections',lo:250,hi:550,p:50,syn:['grounding','ground rod','bonding','ground system']},
{t:'Electrician',c:'Labour',n:'Bonding correction',d:'Correct improper bonding on gas lines, water pipes, or panels',lo:150,hi:380,p:48,syn:['bonding','bonding correction','improper bonding','gas line bonding']},
{t:'Electrician',c:'Labour',n:'Install junction box',d:'Add or replace junction box for wire connections',lo:95,hi:220,p:55,syn:['junction box','j-box','wire splice box','connection box']},
{t:'Electrician',c:'Labour',n:'Replace damaged wiring',d:'Remove and replace damaged wire run',lo:195,hi:650,p:58,syn:['replace wiring','damaged wire','wire replacement','bad wiring']},
{t:'Electrician',c:'Labour',n:'Install low voltage wiring',d:'Run cable, Cat6, coax, or speaker wire',lo:120,hi:350,p:52,syn:['low voltage','cable run','coax','speaker wire','AV wiring']},
{t:'Electrician',c:'Labour',n:'Install network cabling (Cat6)',d:'Run Cat6 ethernet cable, terminate and test',lo:145,hi:320,p:55,syn:['cat6','ethernet','network cable','data cable','cat 6','network run']},
{t:'Electrician',c:'Labour',n:'Install TV mount wiring',d:'Run power and HDMI/coax behind wall for TV mount',lo:145,hi:320,p:58,syn:['tv mount','tv wiring','wall mount wiring','media wiring']},
{t:'Electrician',c:'Labour',n:'Electrical finishing (devices)',d:'Install all devices — outlets, switches, plates — after drywall',lo:350,hi:1200,p:62,syn:['finishing','device install','electrical trim','devices','plates']},
{t:'Electrician',c:'Services',n:'Permit & inspection coordination',d:'Pull electrical permit and coordinate municipal inspection',lo:150,hi:400,p:58,syn:['permit','inspection','electrical permit','code inspection']},
{t:'Electrician',c:'Services',n:'Code compliance upgrades',d:'Bring existing wiring up to current electrical code',lo:350,hi:1500,p:45,syn:['code compliance','code upgrade','bring to code','code violation fix']},
{t:'Electrician',c:'Labour',n:'Install garage wiring',d:'Wire garage for lights, outlets, and opener circuit',lo:450,hi:1200,p:55,syn:['garage wiring','garage electrical','garage outlets','garage lights']},
{t:'Electrician',c:'Labour',n:'Install shop wiring',d:'Wire workshop with circuits for power tools, lighting, and compressor',lo:650,hi:2000,p:48,syn:['shop wiring','workshop electrical','shop circuits','tool circuits']},
{t:'Electrician',c:'Labour',n:'Install transformer (low voltage)',d:'Install low-voltage transformer for landscape or doorbell',lo:120,hi:280,p:50,syn:['transformer','low voltage transformer','landscape transformer','doorbell transformer']},
{t:'Electrician',c:'Services',n:'Lighting layout consultation',d:'Design lighting layout for renovation or new construction',lo:150,hi:350,p:42,syn:['lighting design','lighting layout','light plan','lighting consultation']},
{t:'Electrician',c:'Services',n:'Power loss troubleshooting',d:'Diagnose partial or full power loss — panel, main, or utility issue',lo:135,hi:300,p:82,syn:['power loss','no power','power out','blackout','outage']},
{t:'Electrician',c:'Labour',n:'Install smart home hub wiring',d:'Pre-wire for smart home hub, controllers, and sensors',lo:250,hi:650,p:40,syn:['smart home','hub wiring','home automation','smart wire']},
{t:'Electrician',c:'Services',n:'Load calculation service',d:'Calculate electrical load for panel sizing or renovation planning',lo:195,hi:400,p:45,syn:['load calc','load calculation','panel sizing','electrical load']},
{t:'Electrician',c:'Services',n:'Energy efficiency upgrade',d:'Assess and upgrade lighting, timers, and controls for efficiency',lo:250,hi:800,p:42,syn:['energy efficiency','led upgrade','efficiency audit','energy savings']},
{t:'Electrician',c:'Labour',n:'Remove old wiring',d:'Remove abandoned or obsolete wiring from walls/attic',lo:195,hi:550,p:40,syn:['remove wiring','old wiring','abandoned wire','wire removal']},

// ── HVAC (46 new items) ──
{t:'HVAC',c:'Services',n:'Diagnose no heat',d:'Troubleshoot furnace or heating system not producing heat',lo:135,hi:280,p:92,syn:['no heat','furnace not working','no heating','cold house','furnace diagnosis']},
{t:'HVAC',c:'Services',n:'Diagnose no cooling',d:'Troubleshoot AC not cooling — check compressor, refrigerant, thermostat',lo:135,hi:280,p:90,syn:['no cooling','ac not working','no cold air','ac diagnosis','warm air']},
{t:'HVAC',c:'Labour',n:'Duct sealing',d:'Seal duct joints and connections to reduce air leaks',lo:250,hi:650,p:55,syn:['duct seal','seal ducts','duct leaks','duct tape','mastic']},
{t:'HVAC',c:'Labour',n:'Install ductwork',d:'Fabricate and install new duct runs for heating/cooling',lo:450,hi:1800,p:60,syn:['ductwork','new ducts','install ducts','duct install','hvac ducts']},
{t:'HVAC',c:'Labour',n:'Modify ductwork',d:'Resize, reroute, or add branches to existing ductwork',lo:250,hi:800,p:58,syn:['modify ducts','duct modification','reroute duct','duct change']},
{t:'HVAC',c:'Services',n:'Airflow balancing',d:'Adjust dampers and registers to balance airflow between rooms',lo:195,hi:450,p:55,syn:['airflow balance','air balancing','balance ducts','hot cold rooms']},
{t:'HVAC',c:'Labour',n:'Replace humidifier',d:'Remove old, install new whole-home humidifier on furnace',lo:280,hi:550,p:52,syn:['replace humidifier','humidifier swap','new humidifier']},
{t:'HVAC',c:'Labour',n:'Install dehumidifier',d:'Install whole-home dehumidifier with drain connection',lo:350,hi:800,p:48,syn:['dehumidifier','dehumidifier install','whole home dehumidifier','humidity control']},
{t:'HVAC',c:'Services',n:'Refrigerant leak detection',d:'Locate refrigerant leak using electronic detector or dye test',lo:195,hi:400,p:65,syn:['refrigerant leak','freon leak','leak detection','ac leak']},
{t:'HVAC',c:'Labour',n:'Compressor replacement',d:'Replace failed AC or heat pump compressor',lo:1200,hi:3000,p:55,syn:['compressor','compressor replace','ac compressor','failed compressor']},
{t:'HVAC',c:'Labour',n:'Capacitor replacement',d:'Replace failed run or start capacitor on AC or furnace',lo:120,hi:280,p:72,syn:['capacitor','cap replacement','run capacitor','start capacitor']},
{t:'HVAC',c:'Labour',n:'Ignitor replacement',d:'Replace hot surface ignitor or spark ignitor on furnace',lo:145,hi:300,p:75,syn:['ignitor','igniter','hot surface ignitor','furnace ignitor','hsi']},
{t:'HVAC',c:'Services',n:'Flame sensor cleaning',d:'Clean furnace flame sensor rod to restore proper operation',lo:95,hi:195,p:70,syn:['flame sensor','sensor cleaning','flame rod','furnace shutoff']},
{t:'HVAC',c:'Services',n:'Heat exchanger inspection',d:'Inspect heat exchanger for cracks or corrosion',lo:145,hi:350,p:60,syn:['heat exchanger','cracked heat exchanger','exchanger inspect','co leak']},
{t:'HVAC',c:'Labour',n:'Install gas line for furnace',d:'Run gas line from meter to furnace location',lo:350,hi:800,p:55,syn:['gas line furnace','furnace gas','gas pipe','furnace gas line']},
{t:'HVAC',c:'Labour',n:'Venting installation',d:'Install furnace or water heater venting — B-vent, direct vent, or power vent',lo:250,hi:650,p:58,syn:['venting','vent install','b-vent','flue pipe','exhaust vent']},
{t:'HVAC',c:'Labour',n:'Venting repair',d:'Repair or replace damaged furnace or appliance venting',lo:195,hi:450,p:55,syn:['vent repair','fix venting','damaged vent','flue repair']},
{t:'HVAC',c:'Labour',n:'Install exhaust fan',d:'Install bathroom, kitchen, or utility exhaust fan with ductwork',lo:195,hi:450,p:62,syn:['exhaust fan','bathroom fan','ventilation fan','bath fan']},
{t:'HVAC',c:'Labour',n:'Install range hood venting',d:'Run ductwork for range hood to exterior',lo:250,hi:550,p:58,syn:['range hood vent','hood ductwork','kitchen vent','exhaust hood']},
{t:'HVAC',c:'Labour',n:'Replace mini-split',d:'Remove old mini-split, install new indoor/outdoor units',lo:2500,hi:5500,p:52,syn:['replace mini split','mini split swap','new mini split','ductless replacement']},
{t:'HVAC',c:'Labour',n:'Install rooftop unit',d:'Install commercial rooftop HVAC unit',lo:3500,hi:12000,p:30,syn:['rooftop unit','rtu','commercial hvac','roof unit']},
{t:'HVAC',c:'Labour',n:'Install baseboard heaters',d:'Install electric baseboard heaters with wall-mount control',lo:195,hi:450,p:55,syn:['baseboard heater','baseboard install','electric baseboard','baseboards']},
{t:'HVAC',c:'Labour',n:'Replace baseboard heaters',d:'Remove old and install new baseboard heaters',lo:180,hi:400,p:52,syn:['replace baseboard','baseboard swap','new baseboards']},
{t:'HVAC',c:'Labour',n:'Install radiant floor heating',d:'Install in-floor heating system — electric mat or hydronic',lo:1500,hi:5000,p:40,syn:['radiant floor','in-floor heating','heated floor','floor heat']},
{t:'HVAC',c:'Labour',n:'Boiler installation',d:'Install new hot water boiler for hydronic heating',lo:3500,hi:8000,p:42,syn:['boiler install','new boiler','hydronic boiler','hot water boiler']},
{t:'HVAC',c:'Labour',n:'Boiler repair',d:'Diagnose and repair boiler issue — pump, valve, or controls',lo:250,hi:800,p:55,syn:['boiler repair','fix boiler','boiler not working','boiler issue']},
{t:'HVAC',c:'Services',n:'Boiler maintenance',d:'Annual boiler service — inspect, clean, test safety controls',lo:195,hi:380,p:52,syn:['boiler maintenance','boiler service','boiler tune-up','annual boiler']},
{t:'HVAC',c:'Labour',n:'Smart HVAC integration',d:'Connect HVAC system to smart thermostat or home automation',lo:195,hi:450,p:40,syn:['smart hvac','smart integration','wifi thermostat','connected hvac']},
{t:'HVAC',c:'Services',n:'Seasonal startup (AC)',d:'Spring AC startup — test, clean coils, check refrigerant',lo:145,hi:280,p:65,syn:['ac startup','spring startup','ac commissioning','start ac']},
{t:'HVAC',c:'Services',n:'Seasonal shutdown (winterization)',d:'Winterize AC — cover unit, disconnect power, check furnace',lo:120,hi:250,p:60,syn:['winterize','seasonal shutdown','ac shutdown','winterization']},
{t:'HVAC',c:'Services',n:'Condensate drain cleaning',d:'Clear clogged condensate drain line on AC or furnace',lo:95,hi:195,p:62,syn:['condensate drain','drain clog','ac drain','condensate line']},
{t:'HVAC',c:'Labour',n:'Install intake/exhaust piping',d:'Install PVC intake and exhaust for high-efficiency furnace',lo:250,hi:550,p:55,syn:['intake exhaust','pvc venting','furnace piping','combustion air']},
{t:'HVAC',c:'Labour',n:'Replace air handler',d:'Remove and replace indoor air handler unit',lo:1200,hi:3000,p:45,syn:['air handler','replace air handler','ahu','indoor unit']},
{t:'HVAC',c:'Labour',n:'Install fan coil unit',d:'Install fan coil for hydronic or chilled water system',lo:800,hi:2200,p:35,syn:['fan coil','fcu','fan coil unit','hydronic fan coil']},
{t:'HVAC',c:'Labour',n:'Install ventilation system',d:'Install whole-building ventilation — HRV, ERV, or exhaust',lo:1500,hi:4000,p:42,syn:['ventilation system','whole house ventilation','mechanical ventilation']},
{t:'HVAC',c:'Services',n:'Air quality testing',d:'Test indoor air quality — CO2, humidity, particulates',lo:195,hi:450,p:40,syn:['air quality','iaq test','air test','indoor air']},
{t:'HVAC',c:'Services',n:'Energy efficiency audit',d:'Assess HVAC system efficiency and recommend upgrades',lo:250,hi:550,p:38,syn:['energy audit','efficiency audit','hvac audit','energy assessment']},
{t:'HVAC',c:'Services',n:'Noise/vibration troubleshooting',d:'Diagnose and fix HVAC noise, rattling, or vibration issues',lo:135,hi:300,p:55,syn:['noise','vibration','rattling','hvac noise','loud furnace']},
{t:'HVAC',c:'Labour',n:'Install attic ventilation',d:'Install attic fan or improve soffit/ridge ventilation',lo:250,hi:650,p:45,syn:['attic vent','attic fan','ventilation','attic ventilation','roof vent']},
{t:'HVAC',c:'Labour',n:'Install garage heater',d:'Install gas or electric unit heater in garage',lo:450,hi:1200,p:52,syn:['garage heater','garage heat','unit heater','shop heater']},
{t:'HVAC',c:'Labour',n:'Install shop heater',d:'Install gas-fired or electric unit heater for workshop',lo:550,hi:1500,p:48,syn:['shop heater','workshop heater','shop heat','industrial heater']},
{t:'HVAC',c:'Labour',n:'Install unit heater',d:'Install suspended gas or electric unit heater',lo:450,hi:1200,p:45,syn:['unit heater','suspended heater','hanging heater','overhead heater']},
{t:'HVAC',c:'Labour',n:'Install duct insulation',d:'Insulate exposed ductwork to reduce heat loss',lo:195,hi:550,p:42,syn:['duct insulation','insulate ducts','duct wrap','ductwork insulation']},
{t:'HVAC',c:'Labour',n:'Repair duct leaks',d:'Locate and seal leaking duct connections',lo:195,hi:450,p:52,syn:['duct leak','leaky ducts','duct repair','seal duct leak']},
{t:'HVAC',c:'Services',n:'System performance testing',d:'Measure airflow, temperature split, and system efficiency',lo:195,hi:400,p:48,syn:['performance test','system test','hvac test','efficiency test']},
{t:'HVAC',c:'Services',n:'HVAC inspection report',d:'Full HVAC system inspection with written report',lo:195,hi:400,p:45,syn:['hvac inspection','inspection report','system inspection','hvac report']},

// ── GENERAL CONTRACTOR (66 new items) ──
{t:'General Contractor',c:'Services',n:'Project consultation / estimate',d:'On-site consultation, measurements, and detailed estimate',lo:0,hi:250,p:95,syn:['consultation','estimate','site visit','quote','assessment']},
{t:'General Contractor',c:'Labour',n:'Demolition (interior)',d:'Selective interior demolition — walls, flooring, fixtures',lo:350,hi:1500,p:82,syn:['demo','demolition','tear out','gut','strip']},
{t:'General Contractor',c:'Labour',n:'Framing (walls)',d:'Build or modify interior wall framing',lo:350,hi:1200,p:78,syn:['framing','wall framing','stud wall','frame wall','partition']},
{t:'General Contractor',c:'Labour',n:'Framing (basement)',d:'Frame basement walls and bulkheads for finishing',lo:1500,hi:5000,p:72,syn:['basement framing','frame basement','basement walls','basement kitchen','basement renovation','basement reno']},
{t:'General Contractor',c:'Labour',n:'Framing (additions)',d:'Structural framing for room additions',lo:3000,hi:15000,p:55,syn:['addition framing','room addition','frame addition','house addition']},
{t:'General Contractor',c:'Labour',n:'Drywall repair',d:'Patch holes, fix cracks, or replace damaged drywall sections',lo:120,hi:450,p:80,syn:['drywall repair','patch drywall','hole repair','drywall patch','wall repair']},
{t:'General Contractor',c:'Labour',n:'Tape & mud drywall',d:'Tape joints, apply mud, sand smooth for paint-ready finish',lo:250,hi:800,p:72,syn:['tape and mud','drywall finishing','mud','drywall tape','joint compound']},
{t:'General Contractor',c:'Labour',n:'Interior painting',d:'Paint walls and ceilings — prep, prime, two coats',lo:350,hi:1200,p:85,syn:['painting','interior paint','wall painting','room painting','paint']},
{t:'General Contractor',c:'Labour',n:'Exterior painting',d:'Paint exterior surfaces — siding, trim, doors',lo:1500,hi:6000,p:60,syn:['exterior paint','house painting','siding paint','outside painting']},
{t:'General Contractor',c:'Labour',n:'Install trim & baseboards',d:'Cut, fit, and install baseboard, casing, and crown molding',lo:250,hi:850,p:75,syn:['trim','baseboards','baseboard install','molding','casing','crown']},
{t:'General Contractor',c:'Labour',n:'Install doors (interior)',d:'Install pre-hung or slab interior door with hardware',lo:195,hi:550,p:78,syn:['interior door','door install','bedroom door','closet door','door hang']},
{t:'General Contractor',c:'Labour',n:'Install exterior door',d:'Install exterior entry or patio door with weatherstripping',lo:450,hi:1500,p:65,syn:['exterior door','front door','entry door','patio door','door replacement']},
{t:'General Contractor',c:'Labour',n:'Replace windows',d:'Remove old windows, install new, trim and seal',lo:350,hi:800,p:62,syn:['window replacement','replace window','new windows','window swap']},
{t:'General Contractor',c:'Labour',n:'Flooring installation (vinyl/plank)',d:'Install luxury vinyl plank or sheet vinyl flooring',lo:350,hi:1200,p:78,syn:['vinyl plank','lvp','vinyl flooring','plank flooring','luxury vinyl']},
{t:'General Contractor',c:'Labour',n:'Flooring installation (hardwood)',d:'Install solid or engineered hardwood flooring',lo:650,hi:2500,p:65,syn:['hardwood','hardwood floor','engineered hardwood','wood floor']},
{t:'General Contractor',c:'Labour',n:'Tile installation (floor)',d:'Install floor tile with mortar, grout, and trim',lo:450,hi:1800,p:70,syn:['floor tile','tile floor','ceramic tile','porcelain tile']},
{t:'General Contractor',c:'Labour',n:'Tile installation (shower)',d:'Install shower tile — waterproof membrane, tile, grout',lo:1200,hi:4000,p:62,syn:['shower tile','tile shower','shower surround','bathroom tile']},
{t:'General Contractor',c:'Labour',n:'Grout & tile repair',d:'Replace cracked tile, regrout, or repair grout lines',lo:150,hi:450,p:68,syn:['grout repair','tile repair','regrout','cracked tile','fix grout']},
{t:'General Contractor',c:'Labour',n:'Basement renovation',d:'Full basement renovation — framing, electrical, plumbing, finishing',lo:15000,hi:60000,p:55,syn:['basement reno','finish basement','basement renovation','basement remodel']},
{t:'General Contractor',c:'Labour',n:'Install countertops',d:'Measure, template, and install kitchen or bathroom countertops',lo:500,hi:3500,p:70,syn:['countertop','counter install','granite','quartz','countertop install']},
{t:'General Contractor',c:'Labour',n:'Cabinet refacing',d:'Replace cabinet doors and drawer fronts, refinish frames',lo:2500,hi:8000,p:45,syn:['cabinet reface','refacing','cabinet doors','cabinet update']},
{t:'General Contractor',c:'Labour',n:'Install backsplash',d:'Install tile or panel backsplash in kitchen or bathroom',lo:350,hi:1200,p:68,syn:['backsplash','kitchen backsplash','tile backsplash','splash']},
{t:'General Contractor',c:'Labour',n:'Deck construction',d:'Build new wood or composite deck with railings',lo:3000,hi:15000,p:60,syn:['deck','deck build','new deck','deck construction','patio deck']},
{t:'General Contractor',c:'Labour',n:'Fence installation',d:'Install new fence — wood, vinyl, or chain link',lo:1500,hi:8000,p:62,syn:['fence','fence install','new fence','fence build','privacy fence']},
{t:'General Contractor',c:'Labour',n:'Fence repair',d:'Repair damaged fence sections, posts, or gates',lo:195,hi:800,p:65,syn:['fence repair','fix fence','fence post','gate repair','broken fence']},
{t:'General Contractor',c:'Labour',n:'Roofing repair',d:'Repair roof leak, replace shingles, fix flashing',lo:250,hi:1200,p:68,syn:['roof repair','fix roof','roof leak','shingle repair','flashing']},
{t:'General Contractor',c:'Labour',n:'Roofing replacement',d:'Strip and replace full roof — shingles, underlayment, flashing',lo:5000,hi:20000,p:50,syn:['new roof','roof replacement','reroof','roofing','strip and reshingle']},
{t:'General Contractor',c:'Labour',n:'Siding installation',d:'Install new siding — vinyl, fiber cement, or wood',lo:3000,hi:15000,p:48,syn:['siding','siding install','new siding','hardie board','vinyl siding']},
{t:'General Contractor',c:'Labour',n:'Siding repair',d:'Repair or replace damaged siding sections',lo:250,hi:1000,p:58,syn:['siding repair','fix siding','damaged siding','replace siding']},
{t:'General Contractor',c:'Labour',n:'Insulation installation',d:'Install batt, blown-in, or spray foam insulation',lo:500,hi:3000,p:55,syn:['insulation','insulate','batt insulation','spray foam','blown in']},
{t:'General Contractor',c:'Labour',n:'Vapor barrier install',d:'Install polyethylene vapor barrier in basement or crawlspace',lo:250,hi:800,p:50,syn:['vapor barrier','poly','moisture barrier','vapour barrier']},
{t:'General Contractor',c:'Labour',n:'Soundproofing install',d:'Install soundproofing — insulation, resilient channel, mass loaded vinyl',lo:500,hi:2500,p:38,syn:['soundproofing','sound insulation','noise reduction','acoustic']},
{t:'General Contractor',c:'Labour',n:'Staircase installation',d:'Build or install new staircase — stringers, treads, risers',lo:1500,hi:6000,p:48,syn:['stairs','staircase','stair install','new stairs','stair build']},
{t:'General Contractor',c:'Labour',n:'Railing installation',d:'Install stair or deck railing — wood, metal, or glass',lo:350,hi:2000,p:52,syn:['railing','handrail','stair railing','deck railing','bannister']},
{t:'General Contractor',c:'Labour',n:'Concrete work (pads/walkways)',d:'Pour concrete pad, walkway, or small slab',lo:800,hi:5000,p:52,syn:['concrete','concrete pad','sidewalk','slab','walkway','pour concrete']},
{t:'General Contractor',c:'Labour',n:'Foundation repair',d:'Repair foundation cracks, parging, or waterproofing',lo:1500,hi:10000,p:40,syn:['foundation','foundation repair','crack repair','parging','foundation crack']},
{t:'General Contractor',c:'Labour',n:'Waterproofing (interior)',d:'Interior basement waterproofing — membrane, drainage, sealant',lo:2000,hi:8000,p:42,syn:['waterproofing','interior waterproof','basement waterproof','seepage']},
{t:'General Contractor',c:'Labour',n:'Waterproofing (exterior)',d:'Exterior foundation waterproofing — excavate, membrane, weeping tile',lo:5000,hi:20000,p:35,syn:['exterior waterproof','foundation waterproof','weeping tile','drain tile']},
{t:'General Contractor',c:'Labour',n:'Excavation (small scale)',d:'Small-scale excavation for foundation, drainage, or utilities',lo:500,hi:3000,p:40,syn:['excavation','dig','excavate','trenching','backfill']},
{t:'General Contractor',c:'Labour',n:'Landscaping prep',d:'Grade, level, and prepare site for landscaping',lo:350,hi:1500,p:42,syn:['landscaping','grading','site prep','landscape prep','leveling']},
{t:'General Contractor',c:'Labour',n:'Install shed/structure',d:'Build or assemble shed, workshop, or outbuilding',lo:1500,hi:8000,p:45,syn:['shed','shed build','outbuilding','workshop','shed install']},
{t:'General Contractor',c:'Labour',n:'Garage renovation',d:'Renovate existing garage — insulation, drywall, flooring, electrical',lo:3000,hi:15000,p:48,syn:['garage reno','garage renovation','garage conversion','garage upgrade']},
{t:'General Contractor',c:'Labour',n:'Garage build',d:'Build new detached or attached garage',lo:15000,hi:60000,p:35,syn:['new garage','build garage','garage construction','detached garage']},
{t:'General Contractor',c:'Labour',n:'Structural beam install',d:'Install LVL or steel beam for load-bearing support',lo:1500,hi:5000,p:42,syn:['beam','structural beam','lvl beam','steel beam','support beam']},
{t:'General Contractor',c:'Labour',n:'Load-bearing wall removal',d:'Remove load-bearing wall with proper beam and post support',lo:2000,hi:8000,p:45,syn:['load bearing','wall removal','remove wall','open concept','structural wall']},
{t:'General Contractor',c:'Services',n:'Permit management',d:'Obtain and manage building permits for renovation',lo:150,hi:500,p:62,syn:['permit','building permit','permit application','permit pull']},
{t:'General Contractor',c:'Services',n:'Project management',d:'Ongoing project coordination, scheduling, and quality control',lo:500,hi:3000,p:55,syn:['project management','pm','coordination','manage project']},
{t:'General Contractor',c:'Services',n:'Site supervision',d:'On-site supervision of sub-trades and work progress',lo:350,hi:1200,p:52,syn:['supervision','site super','foreman','oversee','supervise']},
{t:'General Contractor',c:'Services',n:'Subcontractor coordination',d:'Schedule and manage sub-trades — plumber, electrician, HVAC',lo:250,hi:800,p:55,syn:['sub coordination','trades','subcontractor','subtrade','coordinate']},
{t:'General Contractor',c:'Services',n:'Material sourcing',d:'Source, order, and coordinate delivery of materials',lo:100,hi:500,p:50,syn:['material sourcing','ordering','procurement','material pickup']},
{t:'General Contractor',c:'Services',n:'Punch list completion',d:'Complete all remaining items on punch list before handoff',lo:195,hi:800,p:68,syn:['punch list','punchlist','snag list','deficiencies','touch-up']},
{t:'General Contractor',c:'Services',n:'Final cleanup',d:'Post-construction cleanup — sweep, vacuum, wipe, remove debris',lo:150,hi:550,p:72,syn:['cleanup','final clean','post-reno clean','construction clean']},
{t:'General Contractor',c:'Services',n:'Post-reno inspection',d:'Walk-through inspection with homeowner to verify completion',lo:0,hi:195,p:60,syn:['inspection','walkthrough','final inspection','post-reno','handoff']},
{t:'General Contractor',c:'Labour',n:'Exterior finishing',d:'Install exterior trim, fascia, soffit, and flashing',lo:500,hi:2500,p:55,syn:['exterior trim','fascia','soffit','flashing','exterior finish']},
{t:'General Contractor',c:'Labour',n:'Trim carpentry',d:'Custom trim work — crown, wainscoting, built-ins',lo:350,hi:1500,p:58,syn:['trim carpentry','custom trim','wainscoting','crown molding','millwork']},
{t:'General Contractor',c:'Labour',n:'Custom carpentry',d:'Custom-built shelving, benches, mantels, or cabinetry',lo:500,hi:3000,p:50,syn:['custom carpentry','custom build','built-in','shelving','mantel']},
{t:'General Contractor',c:'Labour',n:'Closet build-out',d:'Build custom closet — shelving, rods, drawers, organizers',lo:350,hi:2000,p:52,syn:['closet','closet build','closet organizer','closet system','wardrobe']},
{t:'General Contractor',c:'Labour',n:'Fireplace install (framing/finish)',d:'Frame and finish fireplace surround — mantel, tile, stone',lo:1500,hi:6000,p:42,syn:['fireplace','fireplace surround','mantel','fireplace finish','hearth']},
{t:'General Contractor',c:'Labour',n:'Skylight install',d:'Cut opening, install skylight, flash, and finish interior',lo:1200,hi:4000,p:40,syn:['skylight','skylight install','roof window','velux']},
{t:'General Contractor',c:'Labour',n:'Exterior sealing/weatherproofing',d:'Seal exterior gaps, caulk windows, weatherstrip doors',lo:195,hi:650,p:55,syn:['weatherproofing','sealing','caulk exterior','weather seal','draft']},
{t:'General Contractor',c:'Labour',n:'Dry rot repair',d:'Remove and replace wood damaged by dry rot',lo:350,hi:1500,p:52,syn:['dry rot','rot repair','wood rot','rotted wood','fungus damage']},
{t:'General Contractor',c:'Labour',n:'Minor handyman repairs',d:'Small miscellaneous repairs — doors, hardware, patches',lo:95,hi:350,p:80,syn:['handyman','small repairs','odd jobs','fix-it','miscellaneous']},
{t:'General Contractor',c:'Labour',n:'Rental unit turnover',d:'Repair, paint, clean, and prep rental unit between tenants',lo:500,hi:3000,p:55,syn:['rental turnover','tenant turnover','unit prep','rental prep','landlord']},
{t:'General Contractor',c:'Services',n:'Insurance repair work',d:'Repairs covered by insurance claim — document and restore',lo:500,hi:10000,p:45,syn:['insurance','insurance repair','claim','restoration','damage repair']},
{t:'General Contractor',c:'Services',n:'Renovation consulting',d:'Pre-renovation planning, budgeting, and scope definition',lo:150,hi:500,p:48,syn:['consulting','renovation plan','reno consulting','project planning']},
{t:'General Contractor',c:'Services',n:'Warranty follow-up',d:'Return to address warranty items or callbacks',lo:0,hi:195,p:55,syn:['warranty','callback','follow-up','warranty work','warranty repair']},

// ── PLUMBER MATERIALS (companions to service items) ──
{t:'Plumber',c:'Materials',n:'Kitchen faucet (supply)',d:'Customer-grade kitchen faucet — Moen, Delta, or equivalent',lo:120,hi:450,p:75,syn:['faucet','kitchen faucet','tap','moen','delta','kitchen tap']},
{t:'Plumber',c:'Materials',n:'Bathroom faucet (supply)',d:'Bathroom vanity faucet — single or double handle',lo:80,hi:350,p:72,syn:['bathroom faucet','vanity faucet','lav faucet','basin tap']},
{t:'Plumber',c:'Materials',n:'Toilet (supply)',d:'Standard toilet — elongated bowl, soft-close seat',lo:195,hi:550,p:78,syn:['toilet','toilet unit','commode','elongated toilet']},
{t:'Plumber',c:'Materials',n:'Garburator unit',d:'Garbage disposal unit — 1/2 HP to 1 HP',lo:120,hi:350,p:65,syn:['garburator','garbage disposal','insinkerator','disposal unit']},
{t:'Plumber',c:'Materials',n:'Tank water heater (supply)',d:'40-60 gallon residential gas or electric water heater',lo:450,hi:1200,p:70,syn:['water heater','hot water tank','hwt','tank','water heater unit']},
{t:'Plumber',c:'Materials',n:'Tankless water heater (supply)',d:'On-demand tankless unit — Navien, Rinnai, or equivalent',lo:800,hi:2200,p:55,syn:['tankless','tankless unit','navien','rinnai','on demand']},
{t:'Plumber',c:'Materials',n:'Sump pump (supply)',d:'Submersible sump pump with check valve',lo:150,hi:450,p:58,syn:['sump pump','pump','sump','ejector']},
{t:'Plumber',c:'Materials',n:'Shower valve and trim kit',d:'Pressure-balanced shower valve with trim plate and handle',lo:120,hi:380,p:62,syn:['shower valve','trim kit','shower trim','mixing valve','shower cartridge']},
{t:'Plumber',c:'Materials',n:'Shut-off valves',d:'Quarter-turn ball valves for water supply lines',lo:15,hi:65,p:60,syn:['shut-off','shutoff valve','ball valve','stop valve','supply valve']},
{t:'Plumber',c:'Materials',n:'Drain fittings and P-trap',d:'ABS or PVC drain fittings, P-trap, tailpiece',lo:15,hi:55,p:62,syn:['p-trap','drain fitting','trap','tailpiece','drain parts']},
{t:'Plumber',c:'Materials',n:'Dishwasher supply line and drain',d:'Braided supply hose, drain hose, and air gap or high loop fittings',lo:25,hi:75,p:60,syn:['dishwasher hose','supply line','drain hose','dishwasher parts','dishwasher connection']},
{t:'Plumber',c:'Materials',n:'Fridge water line kit',d:'Copper or braided stainless fridge water supply line',lo:15,hi:55,p:55,syn:['fridge line','ice maker line','fridge water','refrigerator line']},
{t:'Plumber',c:'Materials',n:'Expansion tank',d:'Thermal expansion tank for closed water systems',lo:45,hi:120,p:50,syn:['expansion tank','thermal expansion','pressure tank']},
{t:'Plumber',c:'Materials',n:'PRV (pressure reducing valve)',d:'Pressure reducing valve for main water supply',lo:65,hi:195,p:48,syn:['prv','pressure valve','pressure reducing','regulator']},
{t:'Plumber',c:'Materials',n:'Backwater valve',d:'Mainline backwater/backflow prevention valve',lo:150,hi:400,p:45,syn:['backwater valve','backflow valve','sewer backup','flood prevention']},
{t:'Plumber',c:'Materials',n:'Gas connector and fittings',d:'Flexible gas connector, shut-off valve, and fittings',lo:25,hi:85,p:55,syn:['gas connector','gas flex','gas fitting','gas line parts']},
{t:'Plumber',c:'Materials',n:'Pipe and fittings allowance',d:'Misc pipe, fittings, hangers, and connectors for the job',lo:35,hi:195,p:68,syn:['pipe','fittings','connectors','plumbing parts','misc plumbing']},

// ── ELECTRICIAN MATERIALS ──
{t:'Electrician',c:'Materials',n:'GFCI outlet',d:'Ground fault circuit interrupter outlet — kitchen, bath, exterior',lo:15,hi:35,p:65,syn:['gfci','gfi','ground fault','bathroom outlet']},
{t:'Electrician',c:'Materials',n:'USB outlet',d:'Duplex outlet with built-in USB-A and USB-C ports',lo:20,hi:45,p:55,syn:['usb outlet','usb receptacle','charging outlet','outlet install','outlet upgrade','outlet replacement']},
{t:'Electrician',c:'Materials',n:'Dimmer switch',d:'Single-pole or 3-way dimmer switch',lo:15,hi:65,p:60,syn:['dimmer','dimmer switch','light dimmer']},
{t:'Electrician',c:'Materials',n:'Smart switch',d:'WiFi-enabled smart switch — Lutron, TP-Link, or equivalent',lo:35,hi:85,p:50,syn:['smart switch','wifi switch','lutron','smart light switch']},
{t:'Electrician',c:'Materials',n:'Ceiling fan (supply)',d:'Ceiling fan with light kit — standard or large format',lo:120,hi:450,p:55,syn:['ceiling fan','fan','fan unit']},
{t:'Electrician',c:'Materials',n:'Pot light / recessed can',d:'LED recessed light housing and trim — 4" or 6"',lo:15,hi:55,p:68,syn:['pot light','recessed light','can light','recessed can','pot lamp']},
{t:'Electrician',c:'Materials',n:'Bathroom exhaust fan',d:'Bath fan unit — 80-110 CFM with or without light',lo:45,hi:195,p:58,syn:['bath fan','exhaust fan','bathroom fan unit','ventilation fan']},
{t:'Electrician',c:'Materials',n:'Smoke / CO detector',d:'Combination smoke and CO alarm — hardwired or battery',lo:25,hi:65,p:60,syn:['smoke detector','co detector','alarm','smoke alarm','carbon monoxide']},
{t:'Electrician',c:'Materials',n:'EV charger unit',d:'Level 2 EV charger — 40A, 240V, hardwired',lo:450,hi:1200,p:48,syn:['ev charger','car charger','electric vehicle','level 2','tesla charger']},
{t:'Electrician',c:'Materials',n:'Breaker',d:'Standard or AFCI/GFCI breaker for panel',lo:8,hi:65,p:62,syn:['breaker','circuit breaker','afci breaker','gfci breaker']},
{t:'Electrician',c:'Materials',n:'Weatherproof outlet box',d:'Outdoor rated outlet box with in-use cover',lo:15,hi:45,p:52,syn:['weatherproof box','outdoor box','in-use cover','exterior outlet box']},
{t:'Electrician',c:'Materials',n:'Electrical materials allowance',d:'Staples, connectors, wire nuts, boxes, plates, misc',lo:25,hi:120,p:65,syn:['electrical materials','misc electrical','wire nuts','boxes','supplies']},

// ── HVAC MATERIALS ──
{t:'HVAC',c:'Materials',n:'Furnace filter',d:'Standard or high-efficiency furnace filter — 1" or 4"',lo:8,hi:65,p:70,syn:['filter','furnace filter','air filter','hvac filter','merv']},
{t:'HVAC',c:'Materials',n:'Thermostat (smart)',d:'WiFi smart thermostat — Nest, Ecobee, or equivalent',lo:150,hi:350,p:58,syn:['smart thermostat','nest','ecobee','wifi thermostat']},
{t:'HVAC',c:'Materials',n:'Humidifier pad/panel',d:'Replacement humidifier water panel or pad',lo:15,hi:45,p:52,syn:['humidifier pad','water panel','humidifier filter']},
{t:'HVAC',c:'Materials',n:'Ignitor',d:'Hot surface ignitor for furnace',lo:25,hi:85,p:62,syn:['ignitor','igniter','hsi','hot surface ignitor','furnace ignitor']},
{t:'HVAC',c:'Materials',n:'Capacitor',d:'Run or start capacitor for AC or furnace motor',lo:15,hi:55,p:60,syn:['capacitor','run cap','start cap','motor capacitor']},
{t:'HVAC',c:'Materials',n:'Flame sensor',d:'Furnace flame sensor rod',lo:12,hi:35,p:58,syn:['flame sensor','flame rod','sensor','furnace sensor','flame cleaning','furnace shutdown','ignition','pilot','ignitor','furnace repair']},
{t:'HVAC',c:'Materials',n:'Condensate pump',d:'Condensate removal pump for furnace or AC',lo:45,hi:150,p:50,syn:['condensate pump','condensation pump','drain pump']},
{t:'HVAC',c:'Materials',n:'Vent pipe and fittings',d:'PVC or B-vent pipe and fittings for furnace or water heater venting',lo:35,hi:195,p:55,syn:['vent pipe','b-vent','flue pipe','pvc vent','exhaust pipe']},
{t:'HVAC',c:'Materials',n:'Gas connector and valve',d:'Flexible gas connector with shut-off for furnace or appliance',lo:25,hi:75,p:55,syn:['gas connector','gas flex','gas valve','appliance connector']},
{t:'HVAC',c:'Materials',n:'HVAC materials allowance',d:'Misc fittings, screws, tape, mastic, hangers',lo:25,hi:120,p:62,syn:['hvac materials','misc hvac','supplies','fittings']},

// ── GENERAL CONTRACTOR MATERIALS ──
{t:'General Contractor',c:'Materials',n:'Drywall sheets',d:'4×8 drywall sheets — 1/2" standard or moisture resistant',lo:35,hi:195,p:68,syn:['drywall','gypsum','gyproc','sheetrock','drywall sheet','renovation','basement','reno']},
{t:'General Contractor',c:'Materials',n:'Drywall compound and tape',d:'Joint compound, paper tape, and corner bead',lo:25,hi:85,p:62,syn:['mud','joint compound','tape','drywall tape','compound']},
{t:'General Contractor',c:'Materials',n:'Paint and primer',d:'Interior latex paint and primer — per room',lo:45,hi:195,p:72,syn:['paint','primer','wall paint','ceiling paint','latex paint','renovation','reno','repaint']},
{t:'General Contractor',c:'Materials',n:'Trim and baseboard material',d:'MDF or solid wood baseboard, casing, and shoe molding',lo:50,hi:250,p:60,syn:['baseboard','trim','molding','casing','shoe mold']},
{t:'General Contractor',c:'Materials',n:'Interior door (pre-hung)',d:'Pre-hung interior door with hinges and jamb',lo:95,hi:350,p:62,syn:['interior door','pre-hung door','door slab','bedroom door']},
{t:'General Contractor',c:'Materials',n:'Flooring material (LVP)',d:'Luxury vinyl plank flooring — per box/sq ft',lo:80,hi:350,p:65,syn:['lvp','vinyl plank','flooring','plank flooring','luxury vinyl']},
{t:'General Contractor',c:'Materials',n:'Tile and grout',d:'Ceramic or porcelain tile with grout, thinset, and spacers',lo:95,hi:450,p:58,syn:['tile','grout','thinset','ceramic tile','porcelain']},
{t:'General Contractor',c:'Materials',n:'Lumber and framing material',d:'2×4, 2×6 studs, plates, and blocking lumber',lo:65,hi:350,p:60,syn:['lumber','studs','framing','2x4','2x6','wood','carpentry','dry rot','rot repair','custom build']},
{t:'General Contractor',c:'Materials',n:'Insulation material',d:'Batt, rigid, or spray foam insulation',lo:80,hi:450,p:52,syn:['insulation','batt','spray foam','rigid foam','roxul']},
{t:'General Contractor',c:'Materials',n:'Concrete and rebar',d:'Ready-mix concrete, rebar, mesh, and form material',lo:120,hi:650,p:45,syn:['concrete','rebar','cement','ready mix','forms']},
{t:'General Contractor',c:'Materials',n:'Roofing materials',d:'Shingles, underlayment, flashing, ridge vent, nails',lo:250,hi:1500,p:42,syn:['shingles','roofing','underlayment','flashing','roof material']},
{t:'General Contractor',c:'Materials',n:'Deck material (pressure treated)',d:'Pressure treated lumber, posts, joists, and deck boards',lo:350,hi:2000,p:48,syn:['deck lumber','pressure treated','pt lumber','deck boards','deck material']},
{t:'General Contractor',c:'Materials',n:'Fencing material',d:'Fence boards, posts, rails, concrete, and hardware',lo:250,hi:1500,p:48,syn:['fence material','fence boards','fence posts','rails','fence hardware']},

// ═══════════════════════════════════════════════════════════════
// EXPANDED MATERIALS — granular parts that appear on real invoices
// ═══════════════════════════════════════════════════════════════

// ── PLUMBER — granular materials ──
{t:'Plumber',c:'Materials',n:'Teflon tape and pipe dope',d:'Thread sealant tape and pipe joint compound',lo:5,hi:15,p:72,syn:['teflon','pipe dope','thread seal','ptfe tape','sealant tape']},
{t:'Plumber',c:'Materials',n:'Plumber\'s putty',d:'Sealing putty for drain baskets and faucet bases',lo:5,hi:12,p:65,syn:['putty','plumbers putty','drain seal','basin putty','faucet','sink install','drain basket']},
{t:'Plumber',c:'Materials',n:'Braided supply lines',d:'Stainless steel braided supply hoses — faucet or toilet',lo:8,hi:35,p:70,syn:['supply line','braided hose','supply hose','water supply','connector hose']},
{t:'Plumber',c:'Materials',n:'Wax ring and flange bolts',d:'Toilet wax ring seal with flange bolt set',lo:8,hi:25,p:68,syn:['wax ring','toilet seal','flange bolts','closet bolts','toilet gasket']},
{t:'Plumber',c:'Materials',n:'Toilet fill valve',d:'Universal toilet fill valve — Fluidmaster or equivalent',lo:12,hi:35,p:62,syn:['fill valve','toilet valve','fluidmaster','ballcock','toilet internals']},
{t:'Plumber',c:'Materials',n:'Toilet flapper',d:'Replacement flapper or flush valve seal',lo:8,hi:20,p:60,syn:['flapper','flush valve','toilet flapper','tank flapper']},
{t:'Plumber',c:'Materials',n:'Bidet seat',d:'Electric or non-electric bidet seat attachment',lo:80,hi:550,p:45,syn:['bidet seat','bidet attachment','washlet','bidet']},
{t:'Plumber',c:'Materials',n:'Shower head',d:'Standard or rain shower head with arm',lo:25,hi:195,p:58,syn:['shower head','showerhead','rain head','hand shower','shower arm']},
{t:'Plumber',c:'Materials',n:'Shower cartridge',d:'Replacement pressure-balanced cartridge for shower valve',lo:25,hi:85,p:60,syn:['cartridge','shower cartridge','valve cartridge','moen cartridge','delta cartridge']},
{t:'Plumber',c:'Materials',n:'Bathroom vanity sink',d:'Drop-in or undermount bathroom sink basin',lo:55,hi:280,p:58,syn:['vanity sink','bathroom sink','basin','lav sink','vessel sink']},
{t:'Plumber',c:'Materials',n:'Drain assembly',d:'Pop-up drain assembly for sink — chrome or brushed nickel',lo:15,hi:55,p:58,syn:['drain assembly','pop-up drain','sink drain','drain stopper','sink install','vanity','bathroom sink','kitchen sink']},
{t:'Plumber',c:'Materials',n:'Cleanout plug and cap',d:'ABS or PVC cleanout fitting with cap',lo:8,hi:25,p:52,syn:['cleanout','cleanout plug','drain cleanout','clean out cap']},
{t:'Plumber',c:'Materials',n:'Hose bib / outdoor faucet',d:'Frost-free hose bib or standard outdoor faucet',lo:25,hi:85,p:55,syn:['hose bib','outdoor faucet','garden faucet','exterior tap','frost free']},
{t:'Plumber',c:'Materials',n:'Water filter cartridge',d:'Replacement filter cartridge for under-sink or whole-home system',lo:25,hi:120,p:50,syn:['filter cartridge','water filter','replacement filter','filter']},
{t:'Plumber',c:'Materials',n:'Mixing valve (anti-scald)',d:'Thermostatic mixing valve for water heater output',lo:45,hi:150,p:48,syn:['mixing valve','anti-scald','tmv','tempering valve','water heater','hot water','scald protection','tankless','tank water']},
{t:'Plumber',c:'Materials',n:'Pipe hangers and strapping',d:'Copper or plastic pipe hangers, strapping, and supports',lo:8,hi:35,p:55,syn:['pipe hanger','strapping','pipe support','pipe clamp','j-hook']},
{t:'Plumber',c:'Materials',n:'Soldering supplies',d:'Solder, flux, emery cloth, and torch fuel for copper work',lo:12,hi:45,p:50,syn:['solder','flux','soldering','copper solder','mapp gas']},
{t:'Plumber',c:'Materials',n:'Floor drain cover',d:'Replacement floor drain grate — round or square',lo:12,hi:45,p:45,syn:['floor drain','drain cover','drain grate','floor grate']},
{t:'Plumber',c:'Materials',n:'Anode rod',d:'Replacement magnesium or aluminum anode rod for water heater',lo:25,hi:65,p:48,syn:['anode rod','anode','sacrificial anode','water heater rod']},
{t:'Plumber',c:'Materials',n:'Water heater thermocouple',d:'Thermocouple for gas water heater pilot assembly',lo:12,hi:35,p:52,syn:['thermocouple','pilot','thermocouple replacement','gas pilot']},
{t:'Plumber',c:'Materials',n:'Pipe insulation foam',d:'Foam pipe insulation sleeves for freeze protection',lo:8,hi:45,p:48,syn:['pipe insulation','foam sleeve','pipe wrap','freeze protection']},
{t:'Plumber',c:'Materials',n:'Laundry box',d:'Washing machine outlet box with valves and drain',lo:35,hi:95,p:52,syn:['laundry box','washer box','washing machine box','outlet box']},
{t:'Plumber',c:'Materials',n:'Sump pump check valve',d:'Check valve for sump pump discharge line',lo:15,hi:45,p:50,syn:['check valve','sump check valve','backflow','discharge valve']},
{t:'Plumber',c:'Materials',n:'Tub/shower drain assembly',d:'Waste and overflow drain kit for bathtub',lo:25,hi:85,p:52,syn:['tub drain','shower drain','waste overflow','drain kit','bathtub drain']},
{t:'Plumber',c:'Materials',n:'Gas shut-off valve',d:'Gas ball valve or appliance shut-off',lo:15,hi:55,p:52,syn:['gas valve','gas shut-off','gas shutoff','appliance valve']},

// ── ELECTRICIAN — granular materials ──
{t:'Electrician',c:'Materials',n:'14/2 NMD wire (per roll)',d:'14/2 Romex / NMD90 wire — 15A circuits',lo:45,hi:120,p:68,syn:['14/2','romex','nmd90','14 gauge','15 amp wire','14-2']},
{t:'Electrician',c:'Materials',n:'12/2 NMD wire (per roll)',d:'12/2 Romex / NMD90 wire — 20A circuits',lo:55,hi:150,p:65,syn:['12/2','romex','nmd90','12 gauge','20 amp wire','12-2','shop wiring','garage wiring']},
{t:'Electrician',c:'Materials',n:'10/3 NMD wire',d:'10/3 wire for dryers, hot tubs, or large appliances',lo:80,hi:250,p:55,syn:['10/3','dryer wire','appliance wire','10 gauge','30 amp']},
{t:'Electrician',c:'Materials',n:'6/3 wire (EV/range)',d:'6/3 copper wire for EV charger, range, or 50A circuit',lo:120,hi:350,p:48,syn:['6/3','ev wire','range wire','50 amp','heavy gauge','hot tub wire','spa wire','hot tub wiring']},
{t:'Electrician',c:'Materials',n:'Wire connectors (marrettes)',d:'Twist-on wire connectors — assorted sizes',lo:5,hi:20,p:70,syn:['wire nut','marrette','connector','wire connector','twist-on','wiring','circuit','electrical','rewire','rough-in']},
{t:'Electrician',c:'Materials',n:'Electrical boxes',d:'Plastic or metal outlet/switch boxes — single and double gang',lo:5,hi:25,p:68,syn:['electrical box','outlet box','switch box','gang box','device box']},
{t:'Electrician',c:'Materials',n:'Cover plates',d:'Switch and outlet cover plates — white, ivory, or decora',lo:3,hi:15,p:62,syn:['cover plate','wall plate','face plate','switch plate','decora plate']},
{t:'Electrician',c:'Materials',n:'Cable staples and clamps',d:'Romex staples, cable clamps, and wire supports',lo:5,hi:18,p:60,syn:['staple','cable staple','wire clamp','romex staple','cable support','wiring','circuit run','rough-in','wire run']},
{t:'Electrician',c:'Materials',n:'Conduit and fittings',d:'EMT conduit, connectors, straps, and couplings',lo:15,hi:85,p:52,syn:['conduit','emt','conduit fitting','electrical conduit','garage wiring','shop wiring','commercial','exposed wiring']},
{t:'Electrician',c:'Materials',n:'Light switch (standard)',d:'Single-pole or 3-way toggle or decora switch',lo:3,hi:12,p:68,syn:['switch','light switch','toggle switch','decora switch','wall switch']},
{t:'Electrician',c:'Materials',n:'Standard duplex outlet',d:'15A or 20A duplex receptacle — residential grade',lo:3,hi:10,p:68,syn:['outlet','receptacle','duplex outlet','plug','wall outlet','replace outlet','new outlet','swap outlet']},
{t:'Electrician',c:'Materials',n:'240V receptacle',d:'NEMA 6-30 or 14-30 receptacle for 240V circuit',lo:12,hi:45,p:52,syn:['240v outlet','dryer outlet','range outlet','nema','high voltage outlet']},
{t:'Electrician',c:'Materials',n:'GFCI breaker',d:'Ground fault circuit interrupter breaker for panel',lo:35,hi:75,p:55,syn:['gfci breaker','gfi breaker','ground fault breaker']},
{t:'Electrician',c:'Materials',n:'AFCI breaker',d:'Arc fault circuit interrupter breaker — code required for bedrooms',lo:35,hi:75,p:55,syn:['afci breaker','arc fault','arc fault breaker','bedroom breaker']},
{t:'Electrician',c:'Materials',n:'Disconnect switch',d:'Fused or non-fused disconnect for AC, hot tub, or EV charger',lo:25,hi:85,p:50,syn:['disconnect','disconnect switch','fused disconnect','ac disconnect']},
{t:'Electrician',c:'Materials',n:'Ground rod and clamp',d:'8ft copper grounding rod with acorn clamp',lo:25,hi:55,p:48,syn:['ground rod','grounding rod','ground clamp','acorn clamp','earth ground']},
{t:'Electrician',c:'Materials',n:'Outdoor light fixture',d:'Exterior wall-mount or post light fixture — weather rated',lo:35,hi:250,p:55,syn:['outdoor light','exterior light','porch light','wall sconce','post light']},
{t:'Electrician',c:'Materials',n:'Under-cabinet light',d:'LED under-cabinet light bar or puck lights',lo:25,hi:95,p:52,syn:['under cabinet','cabinet light','puck light','task light','led bar']},
{t:'Electrician',c:'Materials',n:'LED strip and driver',d:'LED strip lighting with power supply/driver',lo:25,hi:120,p:48,syn:['led strip','strip light','tape light','led driver','accent light']},
{t:'Electrician',c:'Materials',n:'Motion sensor',d:'Outdoor or indoor motion sensor — standalone or switch',lo:20,hi:65,p:50,syn:['motion sensor','motion light','occupancy sensor','motion switch']},
{t:'Electrician',c:'Materials',n:'Timer switch',d:'In-wall timer switch for lights, fans, or bathroom heater',lo:15,hi:55,p:50,syn:['timer','timer switch','countdown timer','fan timer']},
{t:'Electrician',c:'Materials',n:'Cat6 cable and jacks',d:'Cat6 ethernet cable, keystone jacks, and wall plates',lo:15,hi:65,p:48,syn:['cat6','ethernet','network cable','keystone','data jack','rj45']},
{t:'Electrician',c:'Materials',n:'Coax cable and connectors',d:'RG6 coax cable with F-connectors for cable/satellite',lo:10,hi:35,p:42,syn:['coax','rg6','cable','f-connector','coaxial','tv mount','tv wiring','satellite','cable tv','low voltage']},
{t:'Electrician',c:'Materials',n:'Doorbell and transformer',d:'Wired doorbell unit with low-voltage transformer',lo:25,hi:95,p:48,syn:['doorbell','chime','doorbell transformer','wired doorbell']},
{t:'Electrician',c:'Materials',n:'Surge protector (whole home)',d:'Whole-home surge protection device for panel',lo:85,hi:280,p:45,syn:['surge protector','spd','surge device','whole home surge','lightning']},
{t:'Electrician',c:'Materials',n:'Generator transfer switch',d:'Manual or automatic transfer switch for generator hookup',lo:250,hi:800,p:42,syn:['transfer switch','generator switch','interlock','generator hookup']},

// ── HVAC — granular materials ──
{t:'HVAC',c:'Materials',n:'Furnace blower motor',d:'Direct-drive or belt-drive blower motor for furnace',lo:150,hi:450,p:55,syn:['blower motor','furnace motor','fan motor','blower','air handler motor']},
{t:'HVAC',c:'Materials',n:'Furnace control board',d:'Integrated furnace control board / circuit board',lo:150,hi:400,p:50,syn:['control board','circuit board','furnace board','icm','pcb']},
{t:'HVAC',c:'Materials',n:'Pressure switch',d:'Furnace pressure switch — draft inducer safety',lo:25,hi:75,p:55,syn:['pressure switch','draft switch','furnace switch','safety switch']},
{t:'HVAC',c:'Materials',n:'Gas valve',d:'Replacement gas valve for furnace — Honeywell, White-Rodgers',lo:120,hi:320,p:50,syn:['gas valve','furnace gas valve','honeywell valve','redundant gas valve']},
{t:'HVAC',c:'Materials',n:'Draft inducer motor',d:'Draft inducer / combustion blower motor',lo:150,hi:380,p:48,syn:['inducer','draft inducer','combustion blower','inducer motor','venter motor']},
{t:'HVAC',c:'Materials',n:'Heat exchanger',d:'Furnace heat exchanger — primary or secondary',lo:350,hi:1200,p:35,syn:['heat exchanger','furnace exchanger','cracked exchanger','exchanger inspection','co leak','furnace replacement']},
{t:'HVAC',c:'Materials',n:'Thermostat wire',d:'18/2 or 18/5 thermostat wire for HVAC controls',lo:15,hi:55,p:55,syn:['thermostat wire','stat wire','control wire','18 gauge']},
{t:'HVAC',c:'Materials',n:'Humidifier water panel',d:'Replacement evaporator pad for whole-home humidifier',lo:12,hi:35,p:55,syn:['humidifier pad','water panel','evaporator pad','humidifier filter']},
{t:'HVAC',c:'Materials',n:'UV bulb (air purifier)',d:'Replacement UV-C bulb for duct-mounted air purifier',lo:35,hi:120,p:45,syn:['uv bulb','uv light','uv lamp','air purifier bulb','uv-c']},
{t:'HVAC',c:'Materials',n:'Duct tape and mastic',d:'HVAC foil tape, mastic sealant, and duct insulation tape',lo:10,hi:35,p:60,syn:['duct tape','mastic','foil tape','hvac tape','duct sealant','duct modification','duct repair','seal duct']},
{t:'HVAC',c:'Materials',n:'Flex duct',d:'Insulated flexible ductwork — 6" to 10" diameter',lo:25,hi:85,p:55,syn:['flex duct','flexible duct','flex pipe','duct hose','ductwork','duct run']},
{t:'HVAC',c:'Materials',n:'Sheet metal duct',d:'Galvanized sheet metal duct — straight, elbows, transitions',lo:35,hi:195,p:50,syn:['sheet metal','metal duct','galvanized duct','rigid duct','duct fitting','ductwork','install ductwork','duct material']},
{t:'HVAC',c:'Materials',n:'Registers and grilles',d:'Supply registers, return grilles, or diffusers',lo:8,hi:45,p:58,syn:['register','grille','vent cover','diffuser','return air','supply register','ductwork','duct install','duct modification','airflow']},
{t:'HVAC',c:'Materials',n:'Damper',d:'Manual or automatic zone damper for ductwork',lo:25,hi:120,p:48,syn:['damper','zone damper','duct damper','balancing damper']},
{t:'HVAC',c:'Materials',n:'PVC vent pipe and fittings',d:'2" or 3" PVC vent pipe, elbows, and couplings for high-efficiency furnace',lo:25,hi:95,p:52,syn:['pvc vent','vent pipe','furnace vent','exhaust pipe','intake pipe','venting repair','vent repair','replace vent']},
{t:'HVAC',c:'Materials',n:'Mini-split line set',d:'Pre-charged or flare copper line set for mini-split installation',lo:65,hi:250,p:48,syn:['line set','lineset','mini split lines','copper lines','refrigerant line']},
{t:'HVAC',c:'Materials',n:'Mini-split indoor unit',d:'Wall-mounted mini-split evaporator / head unit',lo:350,hi:1200,p:45,syn:['indoor unit','head unit','evaporator','wall unit','mini split head']},
{t:'HVAC',c:'Materials',n:'Mini-split outdoor unit',d:'Mini-split condenser / outdoor compressor unit',lo:800,hi:2500,p:42,syn:['outdoor unit','condenser','compressor unit','mini split condenser']},
{t:'HVAC',c:'Materials',n:'Baseboard heater unit',d:'Electric baseboard heater — 500W to 2000W',lo:35,hi:150,p:50,syn:['baseboard','baseboard unit','electric heater','baseboard heater']},
{t:'HVAC',c:'Materials',n:'Garage heater unit',d:'Gas-fired or electric unit heater for garage/shop',lo:250,hi:800,p:45,syn:['garage heater','unit heater','shop heater','hanging heater']},
{t:'HVAC',c:'Materials',n:'Boiler circulator pump',d:'Circulator pump for hydronic boiler system',lo:85,hi:280,p:42,syn:['circulator','circ pump','boiler pump','taco pump','grundfos']},
{t:'HVAC',c:'Materials',n:'Expansion tank (HVAC)',d:'Expansion tank for hydronic heating system',lo:35,hi:120,p:45,syn:['expansion tank','hydronic tank','boiler tank','pressure tank']},

// ── GENERAL CONTRACTOR — granular materials ──
{t:'General Contractor',c:'Materials',n:'Screws and fasteners',d:'Drywall screws, wood screws, deck screws, and misc fasteners',lo:10,hi:55,p:72,syn:['screws','fasteners','drywall screws','wood screws','deck screws']},
{t:'General Contractor',c:'Materials',n:'Construction adhesive',d:'PL Premium, Liquid Nails, or equivalent construction adhesive',lo:8,hi:25,p:62,syn:['adhesive','construction adhesive','pl premium','liquid nails','glue']},
{t:'General Contractor',c:'Materials',n:'Caulking and sealant',d:'Silicone, latex, or polyurethane caulking for interior/exterior',lo:8,hi:35,p:68,syn:['caulk','caulking','sealant','silicone','poly caulk']},
{t:'General Contractor',c:'Materials',n:'Vapor barrier poly',d:'6 mil polyethylene vapor barrier sheeting',lo:25,hi:85,p:50,syn:['vapor barrier','poly','6 mil','moisture barrier','vapour barrier','plastic sheeting']},
{t:'General Contractor',c:'Materials',n:'Tuck tape',d:'Red sheathing tape / tuck tape for vapor barrier seams',lo:8,hi:20,p:52,syn:['tuck tape','sheathing tape','red tape','vapor barrier tape']},
{t:'General Contractor',c:'Materials',n:'Exterior door (pre-hung)',d:'Pre-hung exterior entry door with frame and weatherstripping',lo:350,hi:1500,p:52,syn:['exterior door','entry door','front door','steel door','fiberglass door']},
{t:'General Contractor',c:'Materials',n:'Window (supply)',d:'Vinyl or fiberglass replacement window',lo:250,hi:800,p:55,syn:['window','replacement window','vinyl window','new window']},
{t:'General Contractor',c:'Materials',n:'Backsplash tile',d:'Subway, mosaic, or accent tile for kitchen/bath backsplash',lo:45,hi:250,p:55,syn:['backsplash','subway tile','mosaic','kitchen tile','accent tile']},
{t:'General Contractor',c:'Materials',n:'Thinset mortar',d:'Modified or unmodified thinset for tile installation',lo:15,hi:45,p:55,syn:['thinset','mortar','tile adhesive','tile mortar','modified thinset','tile install','tile floor','tile shower','backsplash']},
{t:'General Contractor',c:'Materials',n:'Grout',d:'Sanded or unsanded grout — cement or epoxy based',lo:12,hi:35,p:55,syn:['grout','tile grout','sanded grout','epoxy grout']},
{t:'General Contractor',c:'Materials',n:'Waterproof membrane',d:'Schluter Kerdi, RedGard, or equivalent waterproofing for shower/tub',lo:35,hi:150,p:50,syn:['waterproof','kerdi','redgard','membrane','shower waterproof','schluter']},
{t:'General Contractor',c:'Materials',n:'Hardwood flooring (supply)',d:'Solid or engineered hardwood — oak, maple, or hickory',lo:150,hi:650,p:52,syn:['hardwood','engineered hardwood','oak floor','maple floor','wood flooring']},
{t:'General Contractor',c:'Materials',n:'Underlayment',d:'Floor underlayment — foam, cork, or plywood for flooring install',lo:15,hi:65,p:55,syn:['underlayment','underlay','subfloor','floor pad','foam underlay']},
{t:'General Contractor',c:'Materials',n:'Cabinet hardware',d:'Knobs, pulls, hinges, and soft-close hardware for cabinets',lo:25,hi:195,p:55,syn:['cabinet hardware','knobs','pulls','hinges','soft close','handles']},
{t:'General Contractor',c:'Materials',n:'Countertop material',d:'Quartz, granite, laminate, or butcher block countertop slab',lo:250,hi:2500,p:52,syn:['countertop','quartz','granite','laminate','butcher block','counter']},
{t:'General Contractor',c:'Materials',n:'Deck boards (composite)',d:'Composite decking boards — Trex, TimberTech, or equivalent',lo:350,hi:1800,p:45,syn:['composite deck','trex','timbertech','composite','deck boards']},
{t:'General Contractor',c:'Materials',n:'Siding material',d:'Vinyl, fiber cement, or wood siding panels',lo:250,hi:1500,p:42,syn:['siding','vinyl siding','hardie','fiber cement','lp smartside']},
{t:'General Contractor',c:'Materials',n:'Shingles (supply)',d:'Asphalt architectural shingles — per bundle/square',lo:35,hi:120,p:45,syn:['shingles','asphalt shingles','roof shingles','architectural shingles','roofing','roof repair','roof replacement','reroofing']},
{t:'General Contractor',c:'Materials',n:'Railing material',d:'Railing posts, balusters, and handrail — wood or metal',lo:120,hi:650,p:45,syn:['railing','handrail','balusters','railing kit','stair railing']},
{t:'General Contractor',c:'Materials',n:'Concrete form material',d:'Form boards, stakes, and release agent for concrete pours',lo:25,hi:120,p:42,syn:['concrete form','form boards','form work','stakes','form release']},
{t:'General Contractor',c:'Materials',n:'Spray foam kit',d:'Two-part spray foam insulation kit for small areas',lo:45,hi:195,p:42,syn:['spray foam','foam kit','expanding foam','insulation foam']},
{t:'General Contractor',c:'Materials',n:'Drop cloths and protection',d:'Plastic sheeting, drop cloths, tape, and floor protection',lo:15,hi:65,p:65,syn:['drop cloth','protection','floor protection','plastic','masking']},
{t:'General Contractor',c:'Materials',n:'Sandpaper and prep supplies',d:'Sandpaper, sanding blocks, TSP, and surface prep materials',lo:10,hi:35,p:58,syn:['sandpaper','sanding','tsp','prep','surface prep']},

// ═══════════════════════════════════════════════════════════════
// GAP-FILL MATERIALS — closes all remaining service→material gaps
// ═══════════════════════════════════════════════════════════════

// ── PLUMBER gap-fills ──
{t:'Plumber',c:'Materials',n:'Plumbing antifreeze',d:'Non-toxic RV/plumbing antifreeze for winterization',lo:8,hi:25,p:45,syn:['antifreeze','winterize','plumbing antifreeze','rv antifreeze','glycol']},
{t:'Plumber',c:'Materials',n:'Hose bib cover / insulation',d:'Insulated outdoor faucet cover for freeze protection',lo:5,hi:15,p:42,syn:['hose bib cover','faucet cover','freeze cap','outdoor cover','winterize']},
{t:'Plumber',c:'Materials',n:'Water heater elements',d:'Upper and lower heating elements for electric water heater',lo:15,hi:55,p:50,syn:['element','heating element','water heater element','electric element']},
{t:'Plumber',c:'Materials',n:'Drain snake / auger cable',d:'Replacement drain snake cable or auger head',lo:15,hi:65,p:42,syn:['drain snake','auger','snake cable','drain cable','auger head']},
{t:'Plumber',c:'Materials',n:'Bathtub',d:'Standard alcove or freestanding bathtub',lo:250,hi:1500,p:40,syn:['bathtub','tub','soaker tub','alcove tub','bath']},
{t:'Plumber',c:'Materials',n:'Water softener unit',d:'Whole-home water softener system',lo:450,hi:1500,p:42,syn:['water softener','softener','water treatment','ion exchange']},
{t:'Plumber',c:'Materials',n:'Backflow preventer',d:'RPZ or double-check backflow prevention assembly',lo:120,hi:450,p:45,syn:['backflow preventer','rpz','double check','backflow assembly','dcva']},
{t:'Plumber',c:'Materials',n:'Recirculation pump',d:'Hot water recirculation pump — timer or on-demand',lo:150,hi:400,p:42,syn:['recirc pump','recirculation','hot water pump','instant hot','grundfos']},
{t:'Plumber',c:'Materials',n:'Pot filler faucet',d:'Wall-mount pot filler faucet for kitchen',lo:120,hi:450,p:38,syn:['pot filler','wall mount faucet','kitchen pot filler']},

// ── ELECTRICIAN gap-fills ──
{t:'Electrician',c:'Materials',n:'Pendant light fixture',d:'Pendant or hanging light fixture — kitchen, dining, entry',lo:45,hi:350,p:55,syn:['pendant','pendant light','hanging light','pendant fixture','island light']},
{t:'Electrician',c:'Materials',n:'Subpanel box',d:'60A-125A sub-panel enclosure with bus bars',lo:85,hi:280,p:48,syn:['subpanel','sub panel','sub-panel box','secondary panel','garage panel']},
{t:'Electrician',c:'Materials',n:'Recessed outlet / TV box',d:'Recessed outlet box and low-voltage HDMI plate for TV mount',lo:15,hi:55,p:48,syn:['recessed outlet','tv box','media box','hdmi plate','tv mount box','low voltage plate']},
{t:'Electrician',c:'Materials',n:'Junction box (large)',d:'4x4 or larger junction box for wire splices',lo:5,hi:20,p:52,syn:['junction box','j-box','splice box','4x4 box','large box']},
{t:'Electrician',c:'Materials',n:'Landscape light fixtures',d:'Low-voltage landscape path or accent light fixtures',lo:25,hi:150,p:45,syn:['landscape light','path light','garden light','accent light','low voltage light']},
{t:'Electrician',c:'Materials',n:'Security light fixture',d:'LED flood light or security light with photocell or motion',lo:35,hi:150,p:48,syn:['security light','flood light','led flood','motion light','photocell']},
{t:'Electrician',c:'Materials',n:'Range hood',d:'Under-cabinet or wall-mount range hood / exhaust fan',lo:85,hi:550,p:48,syn:['range hood','exhaust hood','kitchen hood','vent hood']},
{t:'Electrician',c:'Materials',n:'Hot tub disconnect panel',d:'60A spa disconnect panel with GFCI protection',lo:65,hi:195,p:42,syn:['spa panel','hot tub panel','spa disconnect','gfci disconnect','hot tub box']},

// ── HVAC gap-fills ──
{t:'HVAC',c:'Materials',n:'HRV / ERV unit',d:'Heat recovery or energy recovery ventilator unit',lo:800,hi:2500,p:42,syn:['hrv','erv','heat recovery','energy recovery','ventilator','air exchanger','install hrv','install erv']},
{t:'HVAC',c:'Materials',n:'Gas fireplace unit',d:'Direct-vent gas fireplace insert or freestanding unit',lo:1500,hi:5000,p:35,syn:['gas fireplace','fireplace insert','fireplace unit','direct vent fireplace']},
{t:'HVAC',c:'Materials',n:'Dehumidifier unit',d:'Whole-home ducted dehumidifier — 70-100 pint capacity',lo:350,hi:1200,p:38,syn:['dehumidifier','whole home dehumidifier','dehumidifier unit','humidity']},
{t:'HVAC',c:'Materials',n:'Radiant floor heating kit',d:'Electric radiant heat mat or cable kit with thermostat',lo:250,hi:1200,p:35,syn:['radiant heat','floor heat mat','heated floor kit','in-floor heat','radiant mat']},
{t:'HVAC',c:'Materials',n:'Boiler (supply)',d:'Residential hot water boiler — gas or electric',lo:2000,hi:6000,p:35,syn:['boiler','boiler unit','hydronic boiler','hot water boiler']},
{t:'HVAC',c:'Materials',n:'Zone control panel',d:'Zone control board with transformer for multi-zone HVAC',lo:150,hi:450,p:38,syn:['zone panel','zone control','zone board','multi-zone','zoning']},
{t:'HVAC',c:'Materials',n:'Air handler unit',d:'Indoor air handler for heat pump or AC system',lo:600,hi:2000,p:40,syn:['air handler','ahu','indoor unit','fan coil','air handler unit']},
{t:'HVAC',c:'Materials',n:'Attic fan',d:'Roof-mount or gable-mount attic ventilation fan',lo:120,hi:380,p:42,syn:['attic fan','roof fan','gable fan','attic vent fan','attic ventilation']},

// ── GENERAL CONTRACTOR gap-fills ──
{t:'General Contractor',c:'Materials',n:'Skylight unit',d:'Fixed or vented skylight — Velux or equivalent',lo:250,hi:1200,p:38,syn:['skylight','velux','roof window','skylight unit']},
{t:'General Contractor',c:'Materials',n:'Soundproofing material',d:'Resilient channel, mass loaded vinyl, or acoustic insulation',lo:65,hi:350,p:35,syn:['soundproofing','resilient channel','mlv','acoustic','sound insulation','mass loaded vinyl']},
{t:'General Contractor',c:'Materials',n:'Structural beam (LVL/steel)',d:'LVL beam, PSL beam, or steel I-beam for load-bearing support',lo:250,hi:1500,p:38,syn:['beam','lvl','psl','steel beam','structural beam','i-beam','microllam']},
{t:'General Contractor',c:'Materials',n:'Post and column',d:'Steel post, lally column, or wood support post',lo:45,hi:250,p:40,syn:['post','column','lally column','support post','steel post','jack post','structural beam','deck','load bearing','support']},
{t:'General Contractor',c:'Materials',n:'Childproofing kit',d:'Cabinet locks, outlet covers, corner guards, gate hardware',lo:25,hi:120,p:38,syn:['childproof','baby proof','cabinet locks','outlet covers','corner guards','safety gates']},
{t:'General Contractor',c:'Materials',n:'Grab bars and hardware',d:'ADA-compliant grab bars, mounting hardware, and backing',lo:25,hi:150,p:42,syn:['grab bar','accessibility','ada','safety bar','shower bar','handicap']},
{t:'General Contractor',c:'Materials',n:'Weatherstripping',d:'Door and window weatherstripping — foam, rubber, or v-strip',lo:8,hi:35,p:55,syn:['weatherstrip','weather strip','door seal','draft seal','window seal']},
{t:'General Contractor',c:'Materials',n:'Shed / structure kit',d:'Pre-fab shed kit or materials for small outbuilding',lo:800,hi:5000,p:35,syn:['shed kit','shed materials','outbuilding','storage shed']},
{t:'General Contractor',c:'Materials',n:'Foundation repair materials',d:'Epoxy injection, hydraulic cement, membrane, and sealant',lo:45,hi:350,p:35,syn:['foundation repair','epoxy injection','hydraulic cement','foundation seal','crack repair']},
{t:'General Contractor',c:'Materials',n:'Stair treads and risers',d:'Pre-finished stair treads, risers, and nosing',lo:120,hi:550,p:42,syn:['stair tread','riser','stair parts','nosing','stair material','staircase','stair install','stair build']},
{t:'General Contractor',c:'Materials',n:'Door hardware',d:'Knobs, levers, deadbolts, hinges, and strike plates',lo:25,hi:195,p:58,syn:['door hardware','knob','lever','deadbolt','hinge','door handle','lockset']},
{t:'General Contractor',c:'Materials',n:'Drywall repair kit',d:'Mesh patch, setting compound, sanding sponge for small repairs',lo:10,hi:35,p:60,syn:['drywall patch','mesh patch','wall repair','hole patch','patch kit']},

// ── P1: Missing materials identified in teardown ──
{t:'Plumber',c:'Materials',n:'Black iron gas pipe and fittings',d:'Black iron pipe, couplings, tees, and nipples for gas lines',lo:35,hi:195,p:55,syn:['black iron','gas pipe','iron pipe','gas line','gas fittings','gas piping','install gas']},
{t:'Plumber',c:'Materials',n:'Water hammer arrestor',d:'Mini rester or piston-type water hammer arrestor',lo:15,hi:55,p:48,syn:['water hammer','arrestor','hammer arrestor','banging pipes','pipe noise']},
{t:'Plumber',c:'Materials',n:'Outdoor shower kit',d:'Outdoor shower valve, head, and mounting hardware',lo:85,hi:350,p:35,syn:['outdoor shower','shower kit','exterior shower','pool shower']},
{t:'Electrician',c:'Materials',n:'HDMI / in-wall cable',d:'CL3-rated in-wall HDMI cable for TV mount installation',lo:15,hi:55,p:45,syn:['hdmi','in-wall cable','tv cable','media cable','tv mount','cl3']},
{t:'Electrician',c:'Materials',n:'Aluminum wiring connectors',d:'AlumiConn or Copalum connectors for aluminum-to-copper pigtailing',lo:35,hi:150,p:42,syn:['alumiconn','aluminum connector','al-cu','pigtail','aluminum wiring','aluminum remediation','copalum']},
{t:'HVAC',c:'Materials',n:'Condensate line fittings',d:'PVC tee, trap, cleanout, and fittings for condensate drain',lo:10,hi:35,p:52,syn:['condensate','condensate fitting','condensate trap','ac drain','drain fitting','condensate line']},
{t:'HVAC',c:'Materials',n:'Refrigerant (R410A)',d:'R410A refrigerant — priced per pound for recharge',lo:25,hi:85,p:55,syn:['refrigerant','r410a','freon','recharge','ac refrigerant','coolant']},
{t:'HVAC',c:'Materials',n:'Furnace gaskets and seals',d:'Exhaust gaskets, inducer gaskets, and door seals for furnace',lo:8,hi:35,p:48,syn:['gasket','furnace gasket','exhaust gasket','inducer gasket','furnace seal','door seal']},
{t:'General Contractor',c:'Materials',n:'Concrete sealer',d:'Penetrating or topical concrete sealer for pads and walkways',lo:25,hi:85,p:45,syn:['concrete sealer','sealer','concrete coating','floor sealer','pad sealer','concrete work']},
{t:'General Contractor',c:'Materials',n:'Deck stain and sealer',d:'Exterior deck stain, sealer, or preservative',lo:35,hi:120,p:48,syn:['deck stain','deck sealer','wood stain','deck preservative','deck finish','deck build','fence stain']},
{t:'General Contractor',c:'Materials',n:'Drywall corner bead',d:'Metal or paper-faced corner bead for outside corners',lo:8,hi:25,p:55,syn:['corner bead','drywall corner','outside corner','metal bead','drywall','drywall finish']},
{t:'General Contractor',c:'Materials',n:'Transition strips',d:'Floor transition strips — T-molding, reducer, or threshold',lo:8,hi:35,p:52,syn:['transition','transition strip','t-molding','reducer','threshold','flooring transition','floor edge','flooring install']},

// ═══════════════════════════════════════════════════════════════
// CATALOG EXPANSION v2 — fills coverage gaps for smart fallback
// Focus: weak objects, thin trades, cross-reference synonyms
// ═══════════════════════════════════════════════════════════════

// ── CARPENTER expansion (was 34 items → +30) ──
{t:'Carpenter',c:'Services',n:'Disposal and cleanup',d:'Remove construction debris, sweep, and clean work area',lo:45,hi:150,p:65,syn:['disposal','cleanup','debris removal','clean up','haul away']},
{t:'Carpenter',c:'Labour',n:'Install window trim / casing',d:'Measure, cut, and install window casing and apron',lo:85,hi:195,p:82,syn:['window trim','window casing','apron','window moulding','window frame']},
{t:'Carpenter',c:'Labour',n:'Install chair rail',d:'Install chair rail moulding at standard height',lo:4,hi:9,p:55,syn:['chair rail','chair moulding','wall rail','wainscot cap']},
{t:'Carpenter',c:'Labour',n:'Install shoe moulding',d:'Install quarter-round or shoe moulding at baseboard',lo:2,hi:5,p:60,syn:['shoe moulding','quarter round','base shoe','floor trim']},
{t:'Carpenter',c:'Labour',n:'Build custom shelving',d:'Design and build built-in shelving unit',lo:350,hi:950,p:62,syn:['custom shelves','built-in','bookshelf','built in shelves','wall unit']},
{t:'Carpenter',c:'Labour',n:'Install pantry shelving',d:'Build and mount pantry organization shelving',lo:250,hi:550,p:58,syn:['pantry','pantry shelves','kitchen pantry','pantry organizer']},
{t:'Carpenter',c:'Labour',n:'Install exterior trim / fascia',d:'Replace or install exterior fascia board and trim',lo:195,hi:480,p:65,syn:['fascia','exterior trim','fascia board','rake board','soffit trim']},
{t:'Carpenter',c:'Labour',n:'Build pergola',d:'Construct freestanding or attached pergola structure',lo:1500,hi:5000,p:45,syn:['pergola','arbor','patio cover','shade structure']},
{t:'Carpenter',c:'Labour',n:'Install gate',d:'Build and hang fence gate with hardware and latch',lo:195,hi:550,p:62,syn:['gate','fence gate','garden gate','gate install','gate hardware']},
{t:'Carpenter',c:'Labour',n:'Repair stairs',d:'Fix squeaky treads, tighten risers, reinforce stringers',lo:145,hi:450,p:68,syn:['stair repair','squeaky stairs','loose tread','stair fix','riser repair']},
{t:'Carpenter',c:'Labour',n:'Install attic access / hatch',d:'Cut and frame attic access opening with trim',lo:195,hi:420,p:48,syn:['attic hatch','attic access','scuttle hole','attic door']},
{t:'Carpenter',c:'Labour',n:'Install pet door',d:'Cut and install pet door in interior or exterior door',lo:120,hi:280,p:45,syn:['pet door','dog door','cat door','pet flap']},
{t:'Carpenter',c:'Labour',n:'Install garage shelving',d:'Mount heavy-duty shelving in garage',lo:195,hi:450,p:55,syn:['garage shelves','garage storage','workshop shelves','garage organizer']},
{t:'Carpenter',c:'Labour',n:'Repair deck boards',d:'Remove and replace rotted or damaged deck boards',lo:145,hi:420,p:70,syn:['deck board','deck repair','rotten board','deck replace','board swap']},
{t:'Carpenter',c:'Labour',n:'Install deck railing',d:'Install wood, composite, or metal deck railing to code',lo:250,hi:650,p:62,syn:['deck railing','deck rail','railing install','baluster','spindle']},
{t:'Carpenter',c:'Labour',n:'Install deck stairs',d:'Build and install deck stairs with stringers and treads',lo:350,hi:850,p:55,syn:['deck stairs','deck steps','stringer','deck staircase']},
{t:'Carpenter',c:'Labour',n:'Install lattice / skirting',d:'Install deck skirting or lattice panel underneath deck',lo:145,hi:380,p:48,syn:['lattice','deck skirting','under deck','lattice panel']},
{t:'Carpenter',c:'Labour',n:'Repair fence section',d:'Replace broken fence boards, rails, or posts',lo:145,hi:450,p:72,syn:['fence repair','fence fix','broken fence','fence board','fence post']},
{t:'Carpenter',c:'Labour',n:'Install fence post',d:'Set fence post in concrete with proper depth',lo:65,hi:165,p:65,syn:['fence post','post hole','post set','concrete post','post install']},
{t:'Carpenter',c:'Materials',n:'Deck screws and hardware',d:'Deck screws, joist hangers, post brackets, lag bolts',lo:25,hi:120,p:58,syn:['deck screws','joist hanger','post bracket','deck hardware','lag bolt','deck','deck build','deck repair']},
{t:'Carpenter',c:'Materials',n:'Fence boards and rails',d:'Cedar or pressure-treated fence boards, rails, and posts',lo:120,hi:550,p:55,syn:['fence board','cedar fence','fence rail','fence post','fence material','fence build','fence repair','fence install']},
{t:'Carpenter',c:'Materials',n:'Gate hardware',d:'Gate hinges, latch, springs, and drop rod',lo:25,hi:95,p:52,syn:['gate hardware','gate hinge','gate latch','gate spring','gate drop rod','gate install','fence gate']},
{t:'Carpenter',c:'Materials',n:'Deck stain / sealer',d:'Exterior deck stain, sealer, or preservative',lo:35,hi:120,p:55,syn:['deck stain','deck sealer','wood stain','deck finish','deck preservative']},
{t:'Carpenter',c:'Materials',n:'Caulking and wood filler',d:'Painter caulk, wood filler, putty for trim finishing',lo:8,hi:30,p:62,syn:['caulk','wood filler','putty','nail filler','trim caulk','baseboard','trim','door casing']},
{t:'Carpenter',c:'Materials',n:'Nails and finish fasteners',d:'Finish nails, brad nails, pin nails for trim installation',lo:10,hi:40,p:65,syn:['finish nails','brad nails','pin nails','trim nails','nail gun nails','baseboard','crown','trim','casing']},
{t:'Carpenter',c:'Materials',n:'Wood glue and adhesive',d:'Wood glue, construction adhesive for carpentry joints',lo:8,hi:25,p:50,syn:['wood glue','glue','titebond','carpenter glue','joint adhesive']},
{t:'Carpenter',c:'Materials',n:'Door hardware set',d:'Handle, hinges, strike plate, and screws for door install',lo:25,hi:195,p:60,syn:['door hardware','door handle','hinge','strike plate','lockset','door knob','door install','interior door','exterior door']},
{t:'Carpenter',c:'Materials',n:'Underlayment and foam',d:'Floor underlayment, foam padding for laminate or vinyl plank',lo:15,hi:55,p:58,syn:['underlayment','foam underlay','floor pad','subfloor prep','laminate','vinyl plank','flooring','lvp']},
{t:'Carpenter',c:'Materials',n:'Transition and edge trim',d:'Floor transitions, reducers, end caps, stair nosing',lo:8,hi:45,p:55,syn:['transition strip','reducer','end cap','stair nosing','floor edge','t-moulding','flooring','laminate','vinyl plank','hardwood']},

// ── ROOFING expansion (was 29 items → +20) ──
{t:'Roofing',c:'Services',n:'Drone roof inspection',d:'Drone-based aerial inspection with photo report',lo:145,hi:320,p:65,syn:['drone','aerial inspection','drone inspection','roof drone']},
{t:'Roofing',c:'Services',n:'Gutter cleaning',d:'Clean all gutters and downspouts, flush with water',lo:95,hi:250,p:78,syn:['gutter clean','gutter cleaning','eavestrough clean','downspout flush']},
{t:'Roofing',c:'Labour',n:'Replace vent boot — multiple',d:'Replace cracked vent boots at all plumbing penetrations',lo:250,hi:550,p:72,syn:['vent boot','pipe boot','all boots','multiple vent','roof vent boot']},
{t:'Roofing',c:'Labour',n:'Chimney cap install',d:'Install or replace chimney rain cap or spark arrestor',lo:145,hi:380,p:60,syn:['chimney cap','rain cap','spark arrestor','chimney top','chimney cover']},
{t:'Roofing',c:'Labour',n:'Install roof vent',d:'Cut opening and install roof vent — box, turbine, or powered',lo:145,hi:350,p:62,syn:['roof vent','box vent','turbine vent','attic vent','powered vent','roof ventilation']},
{t:'Roofing',c:'Labour',n:'Seal pipe penetrations',d:'Reseal all pipe and vent penetrations with flashing or caulk',lo:120,hi:280,p:70,syn:['pipe seal','penetration seal','vent seal','roof caulk','roof sealant']},
{t:'Roofing',c:'Labour',n:'Repair fascia board',d:'Replace rotted or damaged fascia section',lo:195,hi:450,p:68,syn:['fascia repair','fascia board','fascia replace','rotten fascia','wood fascia']},
{t:'Roofing',c:'Labour',n:'Install drip edge',d:'Install or replace drip edge flashing along eaves and rakes',lo:145,hi:320,p:65,syn:['drip edge','edge flashing','eave flashing','rake edge','drip flashing']},
{t:'Roofing',c:'Labour',n:'Valley repair',d:'Repair or re-flash roof valley where two slopes meet',lo:250,hi:650,p:60,syn:['valley','valley repair','roof valley','valley flashing','valley leak']},
{t:'Roofing',c:'Materials',n:'Vent boots and pipe collars',d:'Rubber or lead vent boots for roof penetrations',lo:15,hi:55,p:62,syn:['vent boot','pipe collar','pipe boot','lead boot','rubber boot','vent flashing','roof penetration']},
{t:'Roofing',c:'Materials',n:'Roofing nails and fasteners',d:'Coil nails, roofing nails, cap nails, and staples',lo:15,hi:55,p:58,syn:['roofing nails','coil nails','cap nails','roof fasteners','shingle nails','re-roof','shingle','roof repair']},
{t:'Roofing',c:'Materials',n:'Roof sealant and caulk',d:'Roof sealant, flashing cement, and roofing caulk',lo:10,hi:45,p:65,syn:['roof sealant','roof caulk','flashing cement','roof cement','roofing tar','leak repair','flashing','vent boot','chimney']},
{t:'Roofing',c:'Materials',n:'Ridge vent',d:'Ridge vent — shingle-over or aluminum profile',lo:25,hi:85,p:55,syn:['ridge vent','ridge ventilation','shingle over vent','roof ridge','attic ventilation']},
{t:'Roofing',c:'Materials',n:'Chimney flashing kit',d:'Step flashing, counter flashing, and sealant for chimney',lo:45,hi:195,p:55,syn:['chimney flashing','chimney flash kit','step flashing','counter flashing','chimney leak','chimney repair']},
{t:'Roofing',c:'Materials',n:'Gutter and downspout',d:'Aluminum gutter, downspout, elbows, and hangers',lo:45,hi:195,p:58,syn:['gutter','downspout','eavestrough','gutter material','gutter hangers','elbow','gutter install','gutter repair']},
{t:'Roofing',c:'Materials',n:'Soffit panels',d:'Vinyl or aluminum soffit panels and J-channel',lo:35,hi:150,p:52,syn:['soffit','soffit panel','soffit vent','j-channel','soffit material','soffit repair','fascia']},
{t:'Roofing',c:'Materials',n:'Tarp and temp repair material',d:'Heavy-duty tarp, roofing cement, and nails for emergency patch',lo:25,hi:85,p:55,syn:['tarp','emergency','temp repair','roof patch','emergency tarp','emergency repair']},

// ── PAINTER expansion (was 24 items → +22) ──
{t:'Painter',c:'Services',n:'Power wash — exterior',d:'Pressure wash siding, deck, or driveway before painting',lo:150,hi:380,p:72,syn:['power wash','pressure wash','wash','exterior wash','siding wash','deck wash']},
{t:'Painter',c:'Labour',n:'Paint hallway',d:'Prep and paint hallway walls, ceiling, and trim',lo:250,hi:550,p:72,syn:['hallway','hall','corridor','hallway paint','hall paint']},
{t:'Painter',c:'Labour',n:'Paint bathroom',d:'Prep and paint bathroom — walls, ceiling, moisture-resistant paint',lo:250,hi:550,p:70,syn:['bathroom paint','bath paint','bathroom walls','moisture paint']},
{t:'Painter',c:'Labour',n:'Paint kitchen',d:'Prep and paint kitchen walls and ceiling — grease-resistant finish',lo:280,hi:600,p:68,syn:['kitchen paint','kitchen walls','kitchen ceiling']},
{t:'Painter',c:'Labour',n:'Paint baseboard and trim',d:'Sand, prime, and paint all baseboard and door casing',lo:3,hi:8,p:82,syn:['baseboard paint','trim paint','casing paint','door trim paint','wood paint']},
{t:'Painter',c:'Labour',n:'Paint window frames',d:'Scrape, sand, prime, and paint window frames and sills',lo:85,hi:220,p:60,syn:['window paint','window frame','sill paint','window trim']},
{t:'Painter',c:'Labour',n:'Paint closet',d:'Paint interior of closet — walls, ceiling, shelf edges',lo:120,hi:280,p:55,syn:['closet paint','closet interior','paint closet']},
{t:'Painter',c:'Labour',n:'Paint basement',d:'Prep and paint basement walls and ceiling',lo:650,hi:1800,p:55,syn:['basement paint','basement walls','basement ceiling']},
{t:'Painter',c:'Labour',n:'Apply textured finish',d:'Apply knock-down, orange peel, or skip trowel texture',lo:3,hi:7,p:48,syn:['texture','textured','knockdown','orange peel','skip trowel','ceiling texture']},
{t:'Painter',c:'Labour',n:'Remove popcorn ceiling',d:'Scrape popcorn texture, skim coat, sand, and paint',lo:3,hi:7,p:55,syn:['popcorn','popcorn ceiling','scrape ceiling','ceiling removal','stipple']},
{t:'Painter',c:'Labour',n:'Skim coat walls',d:'Apply skim coat to damaged or textured walls for smooth finish',lo:3,hi:6,p:55,syn:['skim coat','smooth walls','level 5','plaster skim','wall smoothing']},
{t:'Painter',c:'Labour',n:'Caulk and fill — prep',d:'Caulk gaps, fill nail holes, sand smooth before painting',lo:85,hi:220,p:80,syn:['caulk','fill','prep','nail holes','gap fill','sand','paint prep','wall prep']},
{t:'Painter',c:'Labour',n:'Spray paint — large area',d:'Spray application for large open areas or new construction',lo:2,hi:5,p:55,syn:['spray','spray paint','airless','sprayer','new construction paint']},
{t:'Painter',c:'Labour',n:'Touch-up painting',d:'Touch up scuffs, chips, and minor damage on existing paint',lo:95,hi:250,p:65,syn:['touch up','touch-up','chip repair','scuff repair','spot repair']},
{t:'Painter',c:'Labour',n:'Paint railing / banister',d:'Sand, prime, and paint stair railing and balusters',lo:195,hi:480,p:55,syn:['railing paint','banister','baluster','stair railing paint']},
{t:'Painter',c:'Materials',n:'Drop cloths and plastic',d:'Canvas drop cloths, plastic sheeting, and floor protection',lo:15,hi:55,p:68,syn:['drop cloth','plastic','floor protection','paint protection','canvas','masking','room paint','wall paint','ceiling paint']},
{t:'Painter',c:'Materials',n:'Painters tape',d:'Blue tape, green tape, and edge tape for masking',lo:8,hi:35,p:70,syn:['painters tape','blue tape','masking tape','frog tape','edge tape','paint prep','room paint','wall paint']},
{t:'Painter',c:'Materials',n:'Brushes and rollers',d:'Paint brushes, roller covers, roller frames, and trays',lo:15,hi:65,p:60,syn:['brush','roller','paint roller','roller cover','paint tray','applicator','room paint','wall paint','trim paint']},
{t:'Painter',c:'Materials',n:'Sandpaper and sanding supplies',d:'Sandpaper, sanding blocks, sponges for paint prep',lo:8,hi:30,p:58,syn:['sandpaper','sanding block','sanding sponge','grit','sand','paint prep','wall prep','trim prep','cabinet prep']},
{t:'Painter',c:'Materials',n:'Wood filler and patching',d:'Wood filler, spackling paste, and patching compound',lo:8,hi:30,p:60,syn:['wood filler','spackle','patching','filler','nail hole filler','drywall patch','wall repair','paint prep']},
{t:'Painter',c:'Materials',n:'Deck stain and finish',d:'Exterior deck stain, transparent or solid, per gallon',lo:35,hi:85,p:58,syn:['deck stain','deck finish','solid stain','transparent stain','semi-transparent','deck','fence stain']},
{t:'Painter',c:'Materials',n:'Cabinet paint and primer',d:'Cabinet-grade enamel paint and bonding primer',lo:55,hi:120,p:55,syn:['cabinet paint','enamel','cabinet primer','bonding primer','cabinet','cabinet refinish']},

// ── LANDSCAPING expansion (was 31 items → +22) ──
{t:'Landscaping',c:'Services',n:'Soil testing',d:'Test soil pH, nutrients, and composition with report',lo:45,hi:150,p:45,syn:['soil test','soil analysis','ph test','nutrient test']},
{t:'Landscaping',c:'Services',n:'Equipment rental',d:'Rental of skid steer, excavator, or plate compactor',lo:150,hi:550,p:50,syn:['equipment rental','rental','skid steer','excavator','compactor']},
{t:'Landscaping',c:'Labour',n:'Install landscape edging',d:'Install metal, plastic, or stone landscape edging along beds',lo:3,hi:8,p:68,syn:['edging','landscape edging','bed edging','border','garden edge','garden bed']},
{t:'Landscaping',c:'Labour',n:'Install landscape fabric',d:'Lay weed barrier fabric under mulch or gravel',lo:1,hi:3,p:60,syn:['landscape fabric','weed barrier','weed cloth','ground cover','mulch','garden bed']},
{t:'Landscaping',c:'Labour',n:'Gravel and aggregate install',d:'Spread gravel, crushed rock, or decorative aggregate',lo:3,hi:8,p:62,syn:['gravel','aggregate','crushed rock','decorative stone','pea gravel','river rock']},
{t:'Landscaping',c:'Labour',n:'Build raised planter',d:'Construct raised garden bed from cedar, stone, or block',lo:195,hi:550,p:55,syn:['raised planter','raised bed','garden box','planter box','vegetable bed']},
{t:'Landscaping',c:'Labour',n:'Install stepping stones',d:'Set stepping stones or flagstone path in sand or mortar',lo:8,hi:18,p:58,syn:['stepping stone','flagstone','stone path','garden stepping','walkway stone']},
{t:'Landscaping',c:'Labour',n:'Install outdoor lighting',d:'Install low-voltage landscape path and accent lights',lo:150,hi:420,p:55,syn:['outdoor light','landscape lighting','path light','garden light','accent light','low voltage']},
{t:'Landscaping',c:'Labour',n:'Drainage correction',d:'Regrade, install catch basin, or extend downspout discharge',lo:350,hi:1200,p:55,syn:['drainage','grading','catch basin','downspout extend','water diversion','yard drain']},
{t:'Landscaping',c:'Labour',n:'Weed control treatment',d:'Apply pre-emergent or selective herbicide treatment',lo:95,hi:250,p:55,syn:['weed control','herbicide','pre-emergent','weed spray','weed treatment']},
{t:'Landscaping',c:'Labour',n:'Fertilizer application',d:'Apply seasonal fertilizer treatment to lawn',lo:65,hi:165,p:60,syn:['fertilizer','lawn feed','fertilize','lawn treatment','turf feed']},
{t:'Landscaping',c:'Labour',n:'Power rake / dethatch',d:'Power rake to remove thatch buildup from lawn',lo:120,hi:280,p:55,syn:['power rake','dethatch','thatch removal','lawn rake']},
{t:'Landscaping',c:'Labour',n:'Prune shrubs and hedges',d:'Shape, thin, and prune ornamental shrubs',lo:120,hi:350,p:72,syn:['prune','shrub pruning','hedge trim','shape shrubs','ornamental pruning']},
{t:'Landscaping',c:'Labour',n:'Remove shrub / bush',d:'Dig out and remove shrub including root ball',lo:65,hi:195,p:60,syn:['remove shrub','shrub removal','bush removal','dig out','root ball']},
{t:'Landscaping',c:'Labour',n:'Install artificial turf',d:'Prepare base and install artificial grass',lo:8,hi:18,p:48,syn:['artificial turf','artificial grass','fake grass','synthetic turf']},
{t:'Landscaping',c:'Materials',n:'Landscape edging material',d:'Metal, plastic, or stone edging material',lo:2,hi:8,p:55,syn:['edging','landscape edging','metal edging','plastic edging','garden edge']},
{t:'Landscaping',c:'Materials',n:'Gravel and aggregate',d:'Crushed rock, pea gravel, or decorative aggregate — per yard',lo:35,hi:95,p:55,syn:['gravel','aggregate','crushed rock','pea gravel','river rock','drain rock']},
{t:'Landscaping',c:'Materials',n:'Landscape fabric',d:'Weed barrier fabric roll',lo:15,hi:55,p:52,syn:['landscape fabric','weed barrier','weed cloth','ground cover fabric']},
{t:'Landscaping',c:'Materials',n:'Stepping stones',d:'Natural or cast stepping stones',lo:5,hi:25,p:50,syn:['stepping stone','flagstone','garden stone','path stone']},
{t:'Landscaping',c:'Materials',n:'Compost and soil amendment',d:'Compost, peat moss, or soil amendment — per yard',lo:35,hi:85,p:55,syn:['compost','peat moss','soil amendment','organic matter','garden soil']},
{t:'Landscaping',c:'Materials',n:'Fertilizer and seed',d:'Lawn fertilizer, grass seed, and starter mix',lo:25,hi:85,p:55,syn:['fertilizer','grass seed','lawn seed','starter','overseeding mix','lawn care','spring cleanup','fall cleanup']},
{t:'Landscaping',c:'Materials',n:'Retaining wall block',d:'Landscape retaining wall block — per unit or pallet',lo:3,hi:10,p:52,syn:['retaining wall','wall block','landscape block','allan block','garden wall']},

// ── HANDYMAN coverage (maps to General Contractor trade) ──
{t:'General Contractor',c:'Labour',n:'Mount TV on wall',d:'Mount television on wall with bracket, conceal cords',lo:95,hi:250,p:72,syn:['tv mount','mount tv','wall mount','television','tv bracket','tv install']},
{t:'General Contractor',c:'Labour',n:'Install curtain rods',d:'Mount curtain rods or blinds in multiple rooms',lo:65,hi:195,p:55,syn:['curtain rod','curtain','blinds','blind install','window treatment','drapes']},
{t:'General Contractor',c:'Labour',n:'Install towel bars and accessories',d:'Mount towel bars, toilet paper holder, and bath accessories',lo:65,hi:165,p:55,syn:['towel bar','bath accessories','tp holder','toilet paper holder','hook','bathroom hardware']},
{t:'General Contractor',c:'Labour',n:'Install weather stripping',d:'Replace or install door and window weather stripping',lo:65,hi:165,p:55,syn:['weather strip','weather stripping','door seal','draft','cold air','window seal','energy']},
{t:'General Contractor',c:'Labour',n:'Fix squeaky floor',d:'Locate and fix squeaky floor boards from above or below',lo:95,hi:280,p:58,syn:['squeaky floor','floor squeak','creaky floor','loose board','floor noise']},
{t:'General Contractor',c:'Labour',n:'Repair drywall cracks',d:'Tape, fill, and sand drywall cracks or nail pops',lo:95,hi:250,p:70,syn:['drywall crack','crack repair','nail pop','tape crack','wall crack','ceiling crack']},
{t:'General Contractor',c:'Labour',n:'Install motion sensor lights',d:'Install motion-activated exterior security lights',lo:120,hi:280,p:55,syn:['motion light','security light','motion sensor','exterior light','flood light']},
{t:'General Contractor',c:'Labour',n:'Assemble furniture',d:'Assemble flatpack or delivered furniture — IKEA, Wayfair, etc.',lo:65,hi:195,p:60,syn:['assemble','ikea','furniture','flatpack','assembly','wayfair','build furniture']},
{t:'General Contractor',c:'Labour',n:'Install mailbox / house numbers',d:'Mount mailbox post or wall-mount, install house numbers',lo:65,hi:195,p:45,syn:['mailbox','house numbers','address numbers','mail box','street number']},

// ═══════════════════════════════════════════════════════════════
// P/E/H DEEP EXPANSION — every common job fully covered for fallback
// ═══════════════════════════════════════════════════════════════

// ── PLUMBER: kitchen sink job coverage ──
{t:'Plumber',c:'Labour',n:'Remove old kitchen sink',d:'Disconnect and remove existing kitchen sink, faucet, and plumbing',lo:95,hi:220,p:72,syn:['remove sink','disconnect sink','old sink','demo sink','kitchen sink remove','kitchen sink replace']},
{t:'Plumber',c:'Labour',n:'Install undermount sink clips',d:'Mount undermount sink with clips, adhesive, and seal',lo:65,hi:165,p:58,syn:['undermount','sink clips','undermount mount','kitchen sink install','undermount sink','drop-in sink']},
{t:'Plumber',c:'Labour',n:'Connect dishwasher drain',d:'Connect dishwasher drain hose with high loop or air gap',lo:65,hi:145,p:62,syn:['dishwasher drain','dishwasher hookup','high loop','air gap','dishwasher','kitchen sink']},
{t:'Plumber',c:'Materials',n:'Kitchen sink (supply)',d:'Stainless steel or composite kitchen sink — single or double bowl',lo:120,hi:550,p:65,syn:['kitchen sink','stainless sink','undermount sink','drop-in sink','composite sink','kitchen sink install','kitchen sink replace']},
{t:'Plumber',c:'Materials',n:'Plumber putty and caulk',d:'Plumber putty for drains plus silicone caulk for sink seal',lo:8,hi:25,p:68,syn:['putty','plumber putty','silicone','caulk','sink seal','drain basket','sink install','kitchen sink','bathroom sink','faucet']},

// ── PLUMBER: bathroom faucet job coverage ──
{t:'Plumber',c:'Labour',n:'Remove old bathroom faucet',d:'Disconnect and remove existing bathroom faucet',lo:45,hi:120,p:65,syn:['remove faucet','old faucet','disconnect faucet','bathroom faucet replace','bathroom faucet remove','vanity faucet replace']},
{t:'Plumber',c:'Materials',n:'Bathroom faucet (supply)',d:'Bathroom vanity faucet — single or double handle, chrome or brushed nickel',lo:80,hi:350,p:72,syn:['bathroom faucet','vanity faucet','lav faucet','basin faucet','bathroom faucet install','bathroom faucet replace','washroom faucet']},
{t:'Plumber',c:'Materials',n:'Pop-up drain assembly',d:'Pop-up drain stopper assembly for bathroom sink',lo:15,hi:55,p:60,syn:['pop-up drain','drain stopper','drain assembly','bathroom sink drain','vanity drain','bathroom faucet','bathroom sink']},
{t:'Plumber',c:'Materials',n:'Faucet supply lines',d:'Braided stainless supply hoses for faucet connection',lo:10,hi:35,p:72,syn:['supply line','braided hose','supply hose','faucet supply','faucet connector','bathroom faucet','kitchen faucet','faucet install','faucet replace']},

// ── PLUMBER: toilet job coverage ──
{t:'Plumber',c:'Labour',n:'Remove old toilet',d:'Disconnect, drain, and remove old toilet and wax ring',lo:65,hi:145,p:70,syn:['remove toilet','old toilet','disconnect toilet','toilet remove','toilet replace']},
{t:'Plumber',c:'Labour',n:'Set toilet on flange',d:'Set new toilet on flange with wax ring, level, and connect',lo:145,hi:280,p:75,syn:['set toilet','install toilet','toilet set','toilet mount','toilet on flange','toilet install']},
{t:'Plumber',c:'Materials',n:'Toilet supply line',d:'Braided stainless toilet supply hose with compression fitting',lo:8,hi:25,p:65,syn:['toilet supply','toilet hose','toilet supply line','toilet connector','toilet install','toilet replace']},
{t:'Plumber',c:'Materials',n:'Toilet flange and hardware',d:'Closet flange, flange repair ring, and closet bolts',lo:12,hi:55,p:58,syn:['toilet flange','closet flange','flange repair','closet bolts','toilet bolts','toilet install','toilet replace','toilet set']},

// ── PLUMBER: water heater job coverage ──
{t:'Plumber',c:'Labour',n:'Drain and disconnect old water heater',d:'Drain tank, disconnect gas/electric, cap lines',lo:95,hi:220,p:72,syn:['drain tank','disconnect water heater','remove water heater','old water heater','water heater replace','water heater remove']},
{t:'Plumber',c:'Labour',n:'Connect gas and venting',d:'Reconnect gas line, vent pipe, and T&P valve discharge',lo:195,hi:380,p:78,syn:['gas connect','venting','vent pipe','gas line','t&p valve','water heater install','water heater replace','gas water heater']},
{t:'Plumber',c:'Labour',n:'Install expansion tank',d:'Mount and connect thermal expansion tank on cold supply',lo:120,hi:250,p:62,syn:['expansion tank','thermal expansion','expansion tank install','water heater','hot water tank']},
{t:'Plumber',c:'Materials',n:'Water heater connector kit',d:'Flex connectors, dielectric unions, gas connector, and T&P valve',lo:35,hi:95,p:65,syn:['connector kit','flex connector','dielectric union','water heater parts','water heater install','water heater replace','hot water tank']},
{t:'Plumber',c:'Materials',n:'Vent pipe and connectors',d:'B-vent or PVC vent pipe, elbows, and connectors for water heater',lo:35,hi:150,p:60,syn:['vent pipe','b-vent','flue pipe','vent connector','water heater vent','water heater install','water heater replace']},

// ── PLUMBER: drain cleaning job coverage ──
{t:'Plumber',c:'Labour',n:'Snake kitchen drain',d:'Auger kitchen sink drain line to clear clog',lo:155,hi:330,p:85,syn:['snake kitchen','kitchen drain','kitchen clog','kitchen clogged','clogged kitchen','drain cleaning kitchen','auger kitchen']},
{t:'Plumber',c:'Labour',n:'Snake bathroom drain',d:'Auger bathroom sink or tub drain to clear clog',lo:120,hi:280,p:82,syn:['snake bathroom','bathroom drain','bathroom clog','tub drain','slow drain','clogged drain','drain cleaning','bathroom sink drain']},
{t:'Plumber',c:'Labour',n:'Camera inspection after clearing',d:'Camera drain after snake to verify clear and check pipe condition',lo:120,hi:280,p:65,syn:['camera','drain camera','camera inspection','verify clear','pipe condition','clogged drain','drain cleaning']},
{t:'Plumber',c:'Services',n:'Drain assessment',d:'Assess drain blockage cause and recommend repair',lo:95,hi:195,p:75,syn:['drain assessment','clog assessment','blockage','drain diagnosis','clogged drain','drain cleaning','slow drain','backed up']},

// ── PLUMBER: shower/tub job coverage ──
{t:'Plumber',c:'Labour',n:'Replace shower cartridge',d:'Remove and replace pressure-balanced shower valve cartridge',lo:145,hi:320,p:80,syn:['shower cartridge','cartridge replace','shower valve repair','shower leak','shower repair','shower drip']},
{t:'Plumber',c:'Labour',n:'Install shower head and arm',d:'Install new shower head, arm, and escutcheon',lo:45,hi:120,p:65,syn:['shower head','shower arm','shower head install','shower head replace','shower install']},
{t:'Plumber',c:'Labour',n:'Re-caulk shower/tub surround',d:'Remove old caulk, clean, apply new silicone around tub or shower',lo:95,hi:220,p:70,syn:['recaulk','caulk shower','caulk tub','shower caulk','tub caulk','mold caulk','shower repair','tub repair']},

// ── PLUMBER: sump pump job coverage ──
{t:'Plumber',c:'Labour',n:'Remove old sump pump',d:'Disconnect and remove failed sump pump from pit',lo:65,hi:145,p:62,syn:['remove sump','old sump','sump pump remove','sump pump replace']},
{t:'Plumber',c:'Labour',n:'Install discharge line',d:'Run sump pump discharge pipe to exterior with check valve',lo:165,hi:350,p:65,syn:['discharge line','discharge pipe','sump discharge','sump pump install','sump pump replace']},
{t:'Plumber',c:'Materials',n:'Sump pump unit',d:'Submersible sump pump with float switch — 1/3 to 1/2 HP',lo:120,hi:380,p:62,syn:['sump pump','sump pump unit','submersible pump','sump pump install','sump pump replace','basement pump']},
{t:'Plumber',c:'Materials',n:'Sump pump check valve',d:'In-line check valve to prevent backflow on discharge',lo:15,hi:55,p:58,syn:['check valve','sump check valve','backflow check','sump pump install','sump pump replace']},
{t:'Plumber',c:'Materials',n:'Sump pump discharge fittings',d:'PVC discharge pipe, elbows, clamps, and exterior termination',lo:25,hi:85,p:55,syn:['discharge fittings','discharge pipe','sump fittings','sump pump install','sump pump replace']},

// ── ELECTRICIAN: pot light / recessed lighting job coverage ──
{t:'Electrician',c:'Labour',n:'Cut holes for pot lights',d:'Mark layout and cut holes for recessed light housings',lo:25,hi:65,p:75,syn:['cut holes','pot light hole','recessed hole','hole saw','pot light install','pot light','recessed light']},
{t:'Electrician',c:'Labour',n:'Run wire for pot lights',d:'Run 14/2 romex from switch location to each pot light',lo:150,hi:380,p:78,syn:['wire run','pot light wire','run wire','romex','circuit','pot light install','pot light','recessed light']},
{t:'Electrician',c:'Labour',n:'Install dimmer for pot lights',d:'Install compatible LED dimmer switch for pot light circuit',lo:85,hi:165,p:72,syn:['dimmer','pot light dimmer','led dimmer','dimmer install','pot light','recessed light']},
{t:'Electrician',c:'Materials',n:'LED pot light housings',d:'Slim LED recessed lights — 4\" or 6\", IC rated',lo:15,hi:55,p:75,syn:['pot light','recessed light','led pot','slim pot light','wafer light','housing','pot light install','recessed light install']},
{t:'Electrician',c:'Materials',n:'14/2 wire for lighting',d:'14/2 NMD90 romex for 15A lighting circuit',lo:35,hi:95,p:70,syn:['14/2','romex','lighting wire','pot light wire','light circuit','pot light install','recessed light install','ceiling light install','light fixture']},
{t:'Electrician',c:'Materials',n:'Dimmer switch',d:'LED-compatible dimmer — single pole or 3-way',lo:15,hi:65,p:68,syn:['dimmer','dimmer switch','led dimmer','smart dimmer','pot light','recessed light','light fixture','ceiling light']},

// ── ELECTRICIAN: panel upgrade job coverage ──
{t:'Electrician',c:'Labour',n:'Disconnect old panel',d:'De-energize and disconnect all circuits from old panel',lo:250,hi:550,p:68,syn:['disconnect panel','old panel','remove panel','panel upgrade','panel replace','200 amp','electrical panel']},
{t:'Electrician',c:'Labour',n:'Install new panel and breakers',d:'Mount new panel, install breakers, and connect all circuits',lo:800,hi:1800,p:72,syn:['new panel','panel install','breaker install','panel mount','panel upgrade','200 amp','electrical panel']},
{t:'Electrician',c:'Labour',n:'Install grounding system',d:'Install ground rod, bonding, and grounding connections',lo:195,hi:380,p:58,syn:['grounding','ground rod','bonding','ground system','panel upgrade','electrical panel','200 amp']},
{t:'Electrician',c:'Materials',n:'200A panel and breakers',d:'200A main breaker panel with branch breakers',lo:350,hi:950,p:62,syn:['200 amp panel','panel box','breaker panel','main breaker','panel upgrade','200 amp','electrical panel']},
{t:'Electrician',c:'Materials',n:'Ground rod and clamp',d:'8ft copper grounding rod with acorn clamp',lo:25,hi:65,p:55,syn:['ground rod','grounding rod','ground clamp','grounding','panel upgrade','electrical panel']},
{t:'Electrician',c:'Materials',n:'Panel upgrade wire',d:'Service entrance cable, grounding wire, and bonding',lo:120,hi:350,p:55,syn:['service cable','entrance cable','panel wire','grounding wire','panel upgrade','200 amp','electrical panel']},

// ── ELECTRICIAN: EV charger job coverage ──
{t:'Electrician',c:'Labour',n:'Run 240V circuit for EV charger',d:'Run dedicated 50A/240V circuit from panel to garage',lo:350,hi:750,p:78,syn:['240v circuit','ev circuit','50 amp circuit','dedicated circuit','ev charger install','ev charger','charging station']},
{t:'Electrician',c:'Labour',n:'Install EV disconnect',d:'Install 60A disconnect or GFCI breaker for EV charger',lo:120,hi:280,p:68,syn:['ev disconnect','disconnect','gfci breaker','ev charger install','ev charger','charging station']},
{t:'Electrician',c:'Labour',n:'Mount EV charger unit',d:'Mount and connect Level 2 EV charging unit on wall',lo:120,hi:280,p:72,syn:['mount charger','ev mount','charger install','ev charger install','ev charger','charging station','level 2']},
{t:'Electrician',c:'Materials',n:'6/3 copper wire',d:'6/3 copper wire for 50A EV charger circuit',lo:150,hi:380,p:62,syn:['6/3 wire','ev wire','50 amp wire','heavy wire','ev charger install','ev charger','charging station']},
{t:'Electrician',c:'Materials',n:'EV charger disconnect',d:'60A fused or non-fused disconnect panel for EV circuit',lo:45,hi:150,p:58,syn:['disconnect','ev disconnect','fused disconnect','disconnect panel','ev charger install','ev charger']},
{t:'Electrician',c:'Materials',n:'NEMA 14-50 outlet',d:'50A/240V outlet for plug-in EV charger connection',lo:15,hi:45,p:65,syn:['nema 14-50','14-50 outlet','ev outlet','240v outlet','ev charger install','ev charger','charging station']},

// ── HVAC: furnace diagnostic/repair job coverage ──
{t:'HVAC',c:'Labour',n:'Furnace diagnostic',d:'Full diagnostic of furnace — test ignition, flame sensor, controls, safeties',lo:135,hi:250,p:92,syn:['furnace diagnostic','diagnose furnace','furnace not working','no heat','furnace repair','furnace troubleshoot','furnace diagnosis']},
{t:'HVAC',c:'Labour',n:'Clean flame sensor',d:'Remove, clean, and reinstall flame sensor rod',lo:85,hi:165,p:78,syn:['flame sensor','flame rod','sensor clean','furnace shutoff','furnace repair','furnace diagnostic','no heat']},
{t:'HVAC',c:'Labour',n:'Replace ignitor',d:'Replace failed hot surface ignitor in furnace',lo:145,hi:280,p:82,syn:['ignitor','igniter','furnace ignitor','hot surface ignitor','hsi','furnace repair','no heat','furnace not working']},
{t:'HVAC',c:'Labour',n:'Replace blower motor',d:'Remove and replace furnace blower motor and capacitor',lo:280,hi:550,p:72,syn:['blower motor','fan motor','furnace blower','blower replace','furnace repair','weak airflow','no air']},
{t:'HVAC',c:'Labour',n:'Replace gas valve',d:'Replace furnace gas valve assembly',lo:280,hi:550,p:62,syn:['gas valve','furnace gas valve','valve replace','furnace repair','no heat','furnace not working']},
{t:'HVAC',c:'Labour',n:'Replace control board',d:'Replace furnace integrated control board',lo:320,hi:650,p:60,syn:['control board','circuit board','furnace board','board replace','furnace repair','error code','furnace not working']},
{t:'HVAC',c:'Materials',n:'Ignitor (HSI)',d:'Replacement hot surface ignitor for furnace',lo:25,hi:85,p:75,syn:['ignitor','igniter','hsi','hot surface ignitor','furnace ignitor','furnace repair','no heat']},
{t:'HVAC',c:'Materials',n:'Flame sensor rod',d:'Replacement flame sensor for furnace',lo:12,hi:35,p:68,syn:['flame sensor','flame rod','sensor rod','furnace sensor','furnace repair','furnace diagnostic']},
{t:'HVAC',c:'Materials',n:'Blower motor',d:'Direct drive blower motor for furnace fan assembly',lo:150,hi:450,p:58,syn:['blower motor','fan motor','furnace motor','furnace blower','furnace repair','weak airflow']},

// ── HVAC: AC replacement job coverage ──
{t:'HVAC',c:'Labour',n:'Remove old AC condenser',d:'Disconnect refrigerant, electrical, and remove old condenser unit',lo:250,hi:480,p:72,syn:['remove condenser','old condenser','disconnect ac','ac remove','ac replace','central air replace','air conditioner replace']},
{t:'HVAC',c:'Labour',n:'Install new AC condenser',d:'Set condenser on pad, connect line set, electrical, and charge',lo:800,hi:1800,p:82,syn:['install condenser','new condenser','ac install','ac condenser','central air install','air conditioner install','air conditioner replace']},
{t:'HVAC',c:'Labour',n:'Install evaporator coil',d:'Install indoor evaporator coil matched to condenser tonnage',lo:350,hi:750,p:72,syn:['evaporator coil','indoor coil','a-coil','coil install','ac install','ac replace','central air','air conditioner']},
{t:'HVAC',c:'Labour',n:'Braze and pressure test',d:'Braze refrigerant connections and nitrogen pressure test',lo:145,hi:320,p:68,syn:['braze','pressure test','nitrogen test','line set','refrigerant','ac install','ac replace','air conditioner']},
{t:'HVAC',c:'Labour',n:'Charge refrigerant',d:'Evacuate system and charge with correct refrigerant',lo:145,hi:320,p:72,syn:['charge','refrigerant charge','r410a','evacuate','ac install','ac replace','air conditioner']},
{t:'HVAC',c:'Materials',n:'AC condenser unit',d:'Outdoor condenser unit — matched to home tonnage',lo:1200,hi:3500,p:65,syn:['condenser','ac unit','outdoor unit','condenser unit','ac install','ac replace','central air','air conditioner']},
{t:'HVAC',c:'Materials',n:'Evaporator coil',d:'Indoor evaporator A-coil matched to condenser',lo:350,hi:950,p:60,syn:['evaporator','a-coil','indoor coil','coil','ac install','ac replace','central air','air conditioner']},
{t:'HVAC',c:'Materials',n:'Refrigerant line set',d:'Pre-insulated copper line set — 25 or 50 ft',lo:85,hi:280,p:62,syn:['line set','lineset','copper line','refrigerant line','ac install','ac replace','mini split','heat pump','air conditioner']},
{t:'HVAC',c:'Materials',n:'Concrete condenser pad',d:'Pre-cast concrete pad for outdoor condenser unit',lo:25,hi:75,p:55,syn:['condenser pad','ac pad','concrete pad','equipment pad','ac install','ac replace','air conditioner']},

// ── HVAC: thermostat job coverage ──
{t:'HVAC',c:'Labour',n:'Remove old thermostat',d:'Disconnect and remove old thermostat, label wires',lo:35,hi:85,p:68,syn:['remove thermostat','old thermostat','disconnect thermostat','thermostat replace']},
{t:'HVAC',c:'Labour',n:'Run C-wire for smart thermostat',d:'Run additional thermostat wire for common (C) wire connection',lo:145,hi:350,p:62,syn:['c-wire','c wire','common wire','thermostat wire','smart thermostat','thermostat install','nest','ecobee']},
{t:'HVAC',c:'Labour',n:'Program and configure thermostat',d:'Set up WiFi, configure schedule, and verify operation',lo:45,hi:120,p:65,syn:['program thermostat','configure','wifi setup','thermostat setup','smart thermostat','thermostat install','nest','ecobee']},
{t:'HVAC',c:'Materials',n:'Smart thermostat unit',d:'WiFi smart thermostat — Nest, Ecobee, or Honeywell',lo:120,hi:350,p:68,syn:['smart thermostat','nest','ecobee','honeywell','wifi thermostat','thermostat install','thermostat replace']},
{t:'HVAC',c:'Materials',n:'Thermostat wire',d:'18/5 thermostat cable for smart thermostat C-wire',lo:15,hi:65,p:55,syn:['thermostat wire','stat wire','18/5','c-wire','thermostat cable','thermostat install','smart thermostat']},
{t:'HVAC',c:'Materials',n:'Thermostat wall plate',d:'Thermostat trim plate or wall patch for old mount hole',lo:8,hi:25,p:50,syn:['wall plate','trim plate','thermostat plate','patch','thermostat install','thermostat replace']},

// ═══════════════════════════════════════════════════════════════
// THIN OBJECT FILL — items for objects with low Core/Related count
// ═══════════════════════════════════════════════════════════════

// ── CEILING FAN (was 2 Core) ──
{t:'Electrician',c:'Labour',n:'Remove old ceiling fan',d:'Disconnect and remove existing ceiling fan and mount',lo:45,hi:120,p:65,syn:['remove fan','remove ceiling fan','old ceiling fan','fan removal','ceiling fan replace']},
{t:'Electrician',c:'Labour',n:'Install fan-rated ceiling box',d:'Install or upgrade ceiling box rated for fan weight and vibration',lo:65,hi:165,p:70,syn:['fan box','ceiling box','fan brace','fan bracket','fan rated box','ceiling fan install','ceiling fan replace','ceiling fan']},
{t:'Electrician',c:'Labour',n:'Wire ceiling fan switch',d:'Run switch leg or install fan/light combo switch',lo:85,hi:195,p:62,syn:['fan switch','fan light switch','combo switch','ceiling fan wire','ceiling fan install','ceiling fan']},
{t:'Electrician',c:'Materials',n:'Fan-rated ceiling box',d:'Heavy-duty fan-rated junction box with brace bar',lo:15,hi:45,p:62,syn:['fan box','brace bar','ceiling box','fan rated','ceiling fan install','ceiling fan replace','ceiling fan']},
{t:'Electrician',c:'Materials',n:'Fan/light wall switch',d:'Dual switch or combo control for ceiling fan and light',lo:12,hi:45,p:55,syn:['fan switch','dual switch','fan light control','fan speed switch','ceiling fan install','ceiling fan']},

// ── BREAKER / TRIPPING (was 4 Core) ──
{t:'Electrician',c:'Labour',n:'Diagnose tripping breaker',d:'Test circuit, identify overload or fault, recommend fix',lo:120,hi:280,p:85,syn:['tripping breaker','breaker trips','diagnose breaker','breaker keeps tripping','overload','short circuit','circuit breaker','breaker fault']},
{t:'Electrician',c:'Labour',n:'Split overloaded circuit',d:'Run new circuit to split overloaded circuits and redistribute loads',lo:280,hi:650,p:72,syn:['circuit split','overloaded circuit','split circuit','too many loads','breaker keeps tripping','tripping breaker','circuit breaker']},
{t:'Electrician',c:'Labour',n:'Tighten connections at panel',d:'Re-torque breaker lugs and neutral/ground connections',lo:95,hi:220,p:68,syn:['loose connection','tighten breaker','panel connections','arcing','hot breaker','tripping breaker','breaker keeps tripping','circuit breaker']},
{t:'Electrician',c:'Materials',n:'Replacement breaker',d:'Standard, AFCI, or GFCI breaker matched to panel',lo:8,hi:75,p:72,syn:['breaker','replacement breaker','new breaker','circuit breaker','afci breaker','gfci breaker','tripping breaker','breaker keeps tripping']},

// ── PIPE LEAK (was 0 Core — "leaky pipe" didn't match) ──
{t:'Plumber',c:'Labour',n:'Locate and access pipe leak',d:'Open wall or ceiling to access leaking pipe section',lo:145,hi:380,p:78,syn:['locate leak','find leak','access leak','open wall','pipe leak','leaky pipe','leaking pipe','burst pipe','broken pipe']},
{t:'Plumber',c:'Labour',n:'Repair pipe section',d:'Cut out damaged section and replace with new pipe and fittings',lo:195,hi:480,p:82,syn:['pipe repair','repair pipe','fix pipe','pipe section','pipe leak','leaky pipe','leaking pipe','burst pipe','broken pipe','pipe replacement']},
{t:'Plumber',c:'Labour',n:'Emergency water shutoff',d:'Locate and close main shutoff to stop active leak',lo:85,hi:195,p:75,syn:['emergency shutoff','water shutoff','stop leak','active leak','pipe leak','leaky pipe','burst pipe','flooding']},
{t:'Plumber',c:'Labour',n:'Patch drywall after pipe repair',d:'Patch wall or ceiling opening after pipe access and repair',lo:95,hi:280,p:60,syn:['drywall patch','wall patch','ceiling patch','repair drywall','pipe leak','pipe repair','leaky pipe','access repair']},
{t:'Plumber',c:'Materials',n:'Pipe repair fittings',d:'Compression couplings, SharkBite, or solder fittings for pipe repair',lo:15,hi:85,p:72,syn:['repair fitting','sharkbite','compression coupling','repair coupling','pipe repair','pipe leak','leaky pipe','burst pipe','pipe fix']},
{t:'Plumber',c:'Materials',n:'Pipe and tubing',d:'Replacement copper, PEX, or ABS pipe for leak repair section',lo:15,hi:95,p:65,syn:['copper pipe','pex pipe','abs pipe','replacement pipe','pipe section','pipe repair','pipe leak','leaky pipe','burst pipe']},

// ── GAS LINE (was 5 Core) ──
{t:'Plumber',c:'Labour',n:'Run gas pipe to appliance',d:'Run black iron or CSST gas line from meter or existing line to appliance location',lo:250,hi:650,p:75,syn:['run gas line','gas pipe run','gas line install','gas hookup','gas connection','gas line','bbq gas line','gas run','new gas line']},
{t:'Plumber',c:'Labour',n:'Pressure test gas line',d:'Pressure test new or existing gas line for leaks',lo:85,hi:195,p:70,syn:['pressure test','gas test','leak test','gas leak test','gas line','gas line install','gas hookup']},
{t:'Plumber',c:'Labour',n:'Connect gas appliance',d:'Connect gas flex line to appliance and test for leaks',lo:85,hi:195,p:72,syn:['gas connect','connect appliance','gas flex','appliance hookup','gas line','gas hookup','bbq gas','stove gas','dryer gas','range gas']},
{t:'Plumber',c:'Materials',n:'Black iron pipe and fittings',d:'Black iron pipe, tees, elbows, nipples, and unions for gas line',lo:35,hi:195,p:62,syn:['black iron','gas pipe','iron pipe','gas fittings','gas nipple','gas tee','gas line','gas line install','gas hookup','gas run']},
{t:'Plumber',c:'Materials',n:'Gas flex connector',d:'Flexible stainless gas connector with shutoff valve',lo:25,hi:85,p:68,syn:['gas flex','gas connector','flex connector','appliance connector','gas line','gas hookup','bbq gas','stove gas','range gas','dryer gas']},
{t:'Plumber',c:'Materials',n:'Gas shutoff valve',d:'Gas ball valve or appliance shutoff for gas line',lo:15,hi:55,p:62,syn:['gas shutoff','gas valve','gas ball valve','appliance valve','gas line','gas hookup','gas line install']},

// ── SUMP PUMP COMPANIONS ──
{t:'Plumber',c:'Services',n:'Sump pump diagnostic',d:'Test pump operation, float switch, and discharge line',lo:95,hi:195,p:72,syn:['sump diagnostic','pump test','sump test','sump pump','sump pump repair','sump not working']},
{t:'Plumber',c:'Labour',n:'Install battery backup sump',d:'Install battery backup sump pump system for power outage protection',lo:350,hi:750,p:52,syn:['battery backup','backup sump','sump backup','power outage','sump pump install','sump pump']},

// ── MINI SPLIT (was 7 Core, 2 Related) ──
{t:'HVAC',c:'Labour',n:'Mount mini split indoor unit',d:'Mount wall bracket and hang indoor head unit',lo:195,hi:380,p:72,syn:['mount indoor','mount head','wall bracket','indoor unit','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Labour',n:'Install mini split outdoor unit',d:'Set outdoor condenser on pad, connect electrical and refrigerant',lo:250,hi:550,p:72,syn:['outdoor unit','condenser','outdoor condenser','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Labour',n:'Run mini split line set',d:'Drill wall penetration, run insulated copper line set between units',lo:195,hi:450,p:68,syn:['line set','copper line','wall penetration','line set run','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Labour',n:'Install mini split disconnect',d:'Install electrical disconnect box for mini split outdoor unit',lo:120,hi:280,p:62,syn:['disconnect','mini split disconnect','electrical disconnect','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Labour',n:'Vacuum and charge mini split',d:'Evacuate line set and charge with factory refrigerant',lo:120,hi:280,p:68,syn:['vacuum','evacuate','charge','refrigerant charge','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Materials',n:'Mini split indoor head unit',d:'Wall-mounted mini split evaporator / head unit',lo:350,hi:1200,p:55,syn:['indoor head','head unit','wall unit','evaporator','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Materials',n:'Mini split outdoor condenser',d:'Mini split outdoor compressor/condenser unit',lo:800,hi:2500,p:55,syn:['outdoor unit','mini split condenser','compressor','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Materials',n:'Mini split line set kit',d:'Pre-insulated copper line set with fittings for mini split',lo:65,hi:250,p:58,syn:['line set','mini split line set','copper line','lineset','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Materials',n:'Mini split wall bracket',d:'Outdoor unit wall bracket or ground stand for mini split',lo:25,hi:85,p:50,syn:['wall bracket','ground stand','condenser bracket','mini split install','mini split','ductless mini split','ductless']},
{t:'HVAC',c:'Materials',n:'Mini split disconnect box',d:'60A non-fused disconnect for mini split electrical connection',lo:25,hi:75,p:52,syn:['disconnect box','mini split disconnect','electrical disconnect','mini split install','mini split','ductless mini split','ductless']},

// ═══════════════════════════════════════════════════════════════
// P/E/H 25-50% EXPANSION — commonly quoted jobs that were EMPTY
// ═══════════════════════════════════════════════════════════════

// ── PLUMBER: tub spout / diverter ──
{t:'Plumber',c:'Labour',n:'Replace tub spout',d:'Remove old tub spout and install new with diverter',lo:85,hi:195,p:72,syn:['tub spout','replace tub spout','spout','tub spout diverter','bathtub spout','tub diverter','diverter']},
{t:'Plumber',c:'Labour',n:'Replace tub/shower diverter valve',d:'Replace 3-handle or single-handle diverter valve behind wall',lo:250,hi:550,p:65,syn:['diverter valve','tub shower diverter','diverter replace','3 handle','diverter','tub diverter','tub spout']},
{t:'Plumber',c:'Materials',n:'Tub spout with diverter',d:'Slip-on or threaded tub spout with pull-up diverter',lo:25,hi:95,p:60,syn:['tub spout','diverter spout','slip on spout','tub diverter','bathtub spout','spout diverter']},

// ── PLUMBER: washing machine / laundry ──
{t:'Plumber',c:'Labour',n:'Install washing machine box',d:'Install laundry outlet box with hot/cold supply valves and drain',lo:250,hi:550,p:68,syn:['washing machine','washer box','laundry box','washing machine hookup','washer hookup','laundry hookup','laundry connection','washing machine box']},
{t:'Plumber',c:'Labour',n:'Install laundry drain standpipe',d:'Install standpipe drain for washing machine with P-trap',lo:155,hi:335,p:62,syn:['laundry drain','standpipe','washer drain','washing machine drain','laundry hookup','washing machine hookup']},
{t:'Plumber',c:'Labour',n:'Replace washing machine valves',d:'Replace seized or leaking laundry supply valves',lo:120,hi:280,p:65,syn:['washer valve','laundry valve','washing machine valve','supply valve','washer hookup','washing machine hookup','laundry hookup']},
{t:'Plumber',c:'Materials',n:'Laundry outlet box with valves',d:'Recessed washing machine box with quarter-turn valves and drain',lo:45,hi:145,p:60,syn:['laundry box','washer box','outlet box','supply box','washing machine hookup','washer hookup','laundry hookup']},
{t:'Plumber',c:'Materials',n:'Washing machine hoses',d:'Braided stainless steel washing machine supply hoses',lo:15,hi:45,p:62,syn:['washer hose','machine hose','laundry hose','supply hose','washing machine hookup','washer hookup','laundry hookup']},

// ── PLUMBER: water pressure ──
{t:'Plumber',c:'Labour',n:'Diagnose low water pressure',d:'Test pressure at multiple points, check PRV, inspect for restrictions',lo:135,hi:280,p:78,syn:['low water pressure','water pressure','weak flow','low flow','no pressure','pressure problem','pressure test','pressure diagnosis']},
{t:'Plumber',c:'Labour',n:'Replace PRV (pressure reducing valve)',d:'Replace failed or out-of-range pressure reducing valve',lo:250,hi:480,p:65,syn:['prv','pressure reducing valve','pressure regulator','low water pressure','water pressure','pressure valve replace']},
{t:'Plumber',c:'Labour',n:'Flush water lines',d:'Flush sediment and debris from supply lines to restore flow',lo:95,hi:220,p:55,syn:['flush lines','flush pipes','sediment','water flush','low water pressure','water pressure','restricted flow']},
{t:'Plumber',c:'Materials',n:'PRV (pressure reducing valve)',d:'Residential pressure reducing valve — 3/4\" or 1\"',lo:65,hi:195,p:55,syn:['prv','pressure reducing valve','pressure regulator','water pressure','low water pressure']},

// ── PLUMBER: drain pipes ──
{t:'Plumber',c:'Labour',n:'Replace kitchen drain pipes',d:'Replace ABS or PVC drain pipes under kitchen sink',lo:165,hi:355,p:72,syn:['kitchen drain pipe','replace drain','drain pipe','kitchen drain','drain replacement','drain line','kitchen sink drain','drain pipes']},
{t:'Plumber',c:'Labour',n:'Replace bathroom drain pipes',d:'Replace drain pipes under bathroom vanity or tub',lo:155,hi:340,p:68,syn:['bathroom drain pipe','replace drain','drain pipe','vanity drain','drain replacement','drain line','drain pipes']},
{t:'Plumber',c:'Materials',n:'ABS drain pipe and fittings',d:'ABS drain pipe, P-trap, fittings, and cement for drain replacement',lo:25,hi:95,p:62,syn:['abs pipe','drain pipe','abs fittings','drain fittings','drain cement','drain replacement','drain pipes','kitchen drain','bathroom drain','drain line']},

// ── PLUMBER: fridge water line ──
{t:'Plumber',c:'Labour',n:'Install fridge water line',d:'Run water supply line from cold water to fridge location',lo:155,hi:335,p:68,syn:['fridge water line','fridge line','ice maker line','refrigerator line','fridge hookup','fridge water','fridge supply','ice maker hookup']},
{t:'Plumber',c:'Labour',n:'Connect fridge ice maker',d:'Connect water supply to fridge ice maker inlet',lo:65,hi:145,p:62,syn:['ice maker','fridge connect','ice maker connect','fridge hookup','fridge water line','refrigerator line','fridge water']},
{t:'Plumber',c:'Materials',n:'Fridge water line kit',d:'Braided stainless or copper fridge water supply line with fittings',lo:15,hi:55,p:60,syn:['fridge line','water line kit','ice maker line','fridge supply','copper line','fridge water line','fridge water','fridge hookup','refrigerator line']},

// ── PLUMBER: sewer ──
{t:'Plumber',c:'Labour',n:'Clear sewer line backup',d:'Auger or jet main sewer line to clear backup',lo:280,hi:650,p:82,syn:['sewer backup','sewage backup','sewer clog','main sewer','sewer line','sewage','sewer blockage','main line backup','backup in basement']},
{t:'Plumber',c:'Labour',n:'Camera inspect sewer line',d:'Run sewer camera to locate break, root intrusion, or collapse',lo:195,hi:420,p:72,syn:['sewer camera','sewer inspect','sewer line camera','root intrusion','sewer backup','sewage backup','sewer line','sewage']},
{t:'Plumber',c:'Labour',n:'Install backwater valve',d:'Install mainline backwater valve to prevent sewer backup into home',lo:1200,hi:3500,p:60,syn:['backwater valve','backflow valve','sewer backup','sewage backup','sewer line','sewage','flood prevention','sewer protection']},
{t:'Plumber',c:'Labour',n:'Sewer line spot repair',d:'Excavate and repair specific section of failed sewer line',lo:1500,hi:5000,p:55,syn:['sewer repair','sewer line repair','sewer break','sewer collapse','sewer backup','sewage backup','sewer line','sewage']},

// ── PLUMBER: floor drain ──
{t:'Plumber',c:'Labour',n:'Install floor drain',d:'Cut concrete, install floor drain with trap and connect to drain line',lo:450,hi:1200,p:55,syn:['floor drain','floor drain install','laundry drain','utility drain','basement floor drain','install floor drain']},
{t:'Plumber',c:'Labour',n:'Replace floor drain cover',d:'Replace damaged or rusted floor drain grate',lo:45,hi:120,p:55,syn:['floor drain cover','drain grate','drain cover','floor drain','floor drain replace']},
{t:'Plumber',c:'Labour',n:'Clear floor drain',d:'Snake or jet clogged floor drain in basement or laundry',lo:155,hi:330,p:72,syn:['floor drain clog','clogged floor drain','floor drain backup','floor drain','blocked floor drain','floor drain clear']},
{t:'Plumber',c:'Materials',n:'Floor drain assembly',d:'Cast iron or PVC floor drain body, grate, and trap primer',lo:35,hi:120,p:52,syn:['floor drain','drain assembly','floor drain body','drain grate','trap primer','floor drain install']},

// ── ELECTRICIAN: generator hookup ──
{t:'Electrician',c:'Labour',n:'Install transfer switch',d:'Install manual or automatic transfer switch for generator connection',lo:450,hi:1200,p:65,syn:['transfer switch','generator hookup','generator install','backup generator','generator connection','standby generator','interlock']},
{t:'Electrician',c:'Labour',n:'Install generator interlock',d:'Install interlock kit on panel for portable generator connection',lo:250,hi:550,p:62,syn:['interlock','generator interlock','interlock kit','portable generator','generator hookup','generator install','generator connection']},
{t:'Electrician',c:'Labour',n:'Install generator inlet box',d:'Mount power inlet box on exterior wall for generator cord connection',lo:195,hi:380,p:58,syn:['inlet box','power inlet','generator inlet','generator hookup','generator install','generator connection','generator cord']},
{t:'Electrician',c:'Materials',n:'Transfer switch unit',d:'Manual or automatic transfer switch — 100A or 200A',lo:250,hi:850,p:55,syn:['transfer switch','generator switch','ats','automatic transfer','generator hookup','generator install','generator']},
{t:'Electrician',c:'Materials',n:'Generator interlock kit',d:'Panel interlock kit with inlet connection breaker',lo:120,hi:280,p:55,syn:['interlock kit','generator interlock','panel interlock','generator hookup','generator install','generator']},
{t:'Electrician',c:'Materials',n:'Power inlet box',d:'30A or 50A exterior power inlet box with flanged plug',lo:45,hi:150,p:52,syn:['inlet box','power inlet','flanged inlet','generator inlet','generator hookup','generator install','generator']},

// ── ELECTRICIAN: security camera ──
{t:'Electrician',c:'Labour',n:'Install security camera wiring',d:'Run power and data cable for security camera locations',lo:120,hi:320,p:62,syn:['security camera','camera wiring','camera install','surveillance','cctv','camera wire run','security camera install','ring camera']},
{t:'Electrician',c:'Labour',n:'Mount and connect security cameras',d:'Mount cameras, connect power and network, configure basic setup',lo:195,hi:450,p:58,syn:['mount camera','connect camera','camera setup','security camera install','security camera','surveillance','cctv']},
{t:'Electrician',c:'Materials',n:'Security camera cable and hardware',d:'Cat6 or PoE cable, mounting brackets, junction boxes for cameras',lo:35,hi:150,p:52,syn:['camera cable','poe cable','camera bracket','camera mount','security camera','camera install','surveillance']},

// ── ELECTRICIAN: garage wiring ──
{t:'Electrician',c:'Labour',n:'Wire garage — full electrical',d:'Wire new or existing garage with outlets, lights, and opener circuit',lo:550,hi:1500,p:62,syn:['wire garage','garage wiring','garage electrical','wire new garage','garage circuit','garage outlets','garage lights','garage wiring install']},
{t:'Electrician',c:'Labour',n:'Install garage subpanel',d:'Install subpanel in garage fed from main panel',lo:450,hi:1200,p:55,syn:['garage subpanel','garage panel','sub panel','garage electrical','wire garage','garage wiring']},
{t:'Electrician',c:'Labour',n:'Run underground feed to garage',d:'Trench and run underground conduit and wire from house to detached garage',lo:650,hi:1800,p:50,syn:['underground feed','conduit trench','wire to garage','detached garage','garage wiring','wire new garage','garage electrical']},
{t:'Electrician',c:'Materials',n:'Garage wiring package',d:'Wire, outlets, switches, boxes, and connectors for garage electrical',lo:120,hi:380,p:55,syn:['garage wire','garage electrical','garage materials','wire garage','garage wiring']},

// ── ELECTRICIAN: dedicated circuit ──
{t:'Electrician',c:'Labour',n:'Run dedicated circuit',d:'Run new dedicated circuit from panel to specific outlet location',lo:250,hi:550,p:78,syn:['dedicated circuit','new circuit','add circuit','fridge circuit','appliance circuit','dedicated line','home run','circuit run']},
{t:'Electrician',c:'Labour',n:'Install dedicated outlet',d:'Install outlet on new dedicated circuit for appliance',lo:120,hi:250,p:72,syn:['dedicated outlet','appliance outlet','fridge outlet','microwave outlet','dedicated circuit','appliance circuit','new circuit']},

// ── ELECTRICIAN: bathroom fan ──
{t:'Electrician',c:'Labour',n:'Install bathroom exhaust fan',d:'Mount bathroom fan, connect wiring, and run duct to exterior',lo:250,hi:550,p:72,syn:['bathroom fan install','bath fan install','exhaust fan install','bathroom exhaust install','bathroom ventilation','fan light combo','bathroom fan','bath fan']},
{t:'Electrician',c:'Labour',n:'Replace bathroom exhaust fan',d:'Remove old fan, install new, reconnect wiring and duct',lo:195,hi:420,p:70,syn:['replace bathroom fan','replace bath fan','fan replacement','bathroom fan replace','bath fan replace','bathroom fan','bath fan']},
{t:'Electrician',c:'Labour',n:'Run exhaust fan duct',d:'Run insulated flex duct from fan to roof cap or soffit vent',lo:120,hi:320,p:62,syn:['fan duct','exhaust duct','vent duct','duct to exterior','bathroom fan install','bathroom fan','bath fan install']},
{t:'Electrician',c:'Labour',n:'Install fan timer switch',d:'Install countdown timer switch for bathroom exhaust fan',lo:85,hi:165,p:60,syn:['fan timer','timer switch','bathroom timer','fan switch','bathroom fan','bath fan','exhaust fan']},
{t:'Electrician',c:'Materials',n:'Bathroom exhaust fan unit',d:'Bath fan — 80-110 CFM with or without light/heater',lo:45,hi:250,p:62,syn:['bath fan','exhaust fan unit','fan unit','bathroom fan unit','bathroom fan','bath fan install','fan light combo']},
{t:'Electrician',c:'Materials',n:'Exhaust fan duct kit',d:'Insulated flex duct, roof cap or soffit vent, clamps',lo:25,hi:85,p:55,syn:['fan duct','duct kit','roof cap','soffit vent','vent cap','bathroom fan install','bathroom fan','bath fan']},

// ── ELECTRICIAN: hot tub / spa wiring ──
{t:'Electrician',c:'Labour',n:'Wire hot tub circuit',d:'Run 240V/50A circuit from panel to hot tub location with GFCI',lo:550,hi:1400,p:65,syn:['hot tub wiring','spa wiring','hot tub electrical','jacuzzi wiring','spa circuit','wire hot tub','hot tub install']},
{t:'Electrician',c:'Labour',n:'Install hot tub disconnect',d:'Install 60A GFCI disconnect within sight of hot tub',lo:195,hi:380,p:62,syn:['hot tub disconnect','spa disconnect','gfci disconnect','hot tub electrical','spa wiring','wire hot tub','hot tub']},
{t:'Electrician',c:'Materials',n:'Hot tub wiring package',d:'6/3 wire, GFCI spa panel, conduit, and connectors',lo:195,hi:450,p:55,syn:['hot tub wire','spa wire','6/3 wire','spa panel','gfci panel','hot tub wiring','spa wiring','wire hot tub','hot tub']},

// ── HVAC: AC contactor ──
{t:'HVAC',c:'Labour',n:'Replace AC contactor',d:'Replace burned or pitted contactor on outdoor AC unit',lo:145,hi:320,p:72,syn:['ac contactor','contactor replace','contactor repair','contactor burned','replace contactor','contactor','ac repair']},
{t:'HVAC',c:'Materials',n:'AC contactor',d:'Replacement contactor for condenser unit — 30A or 40A',lo:25,hi:75,p:60,syn:['contactor','ac contactor','condenser contactor','relay','contactor replace','contactor repair','ac repair']},

// ── HVAC: airflow / hot-cold spots ──
{t:'HVAC',c:'Labour',n:'Airflow balancing',d:'Adjust dampers and registers to balance heating/cooling between rooms',lo:195,hi:450,p:62,syn:['airflow balance','air balancing','balance ducts','hot cold rooms','hot and cold spots','uneven heating','uneven cooling','airflow problem','one room cold','one room hot']},
{t:'HVAC',c:'Labour',n:'Install balancing dampers',d:'Install manual balancing dampers in duct branches',lo:195,hi:420,p:55,syn:['balancing damper','duct damper','manual damper','airflow','hot and cold spots','hot cold rooms','airflow balance','airflow problem']},
{t:'HVAC',c:'Labour',n:'Add duct run to room',d:'Extend ductwork to underserved room with new register',lo:350,hi:850,p:58,syn:['add duct','new duct run','extend duct','duct to room','hot and cold spots','hot cold rooms','one room cold','one room hot','airflow problem']},
{t:'HVAC',c:'Labour',n:'Seal and insulate ductwork',d:'Seal duct joints with mastic and add insulation to exposed runs',lo:250,hi:650,p:55,syn:['seal ducts','insulate ducts','duct seal','duct insulation','hot and cold spots','hot cold rooms','airflow problem','energy loss']},

// ── HVAC: AC blowing warm air ──
{t:'HVAC',c:'Labour',n:'Diagnose AC not cooling',d:'Full diagnostic of AC system — check refrigerant, compressor, electrical, airflow',lo:135,hi:280,p:88,syn:['ac not cooling','not blowing cold','ac diagnostic','ac warm air','warm air from ac','no cold air','ac not blowing cold','ac blowing warm']},
{t:'HVAC',c:'Labour',n:'Clean condenser coils',d:'Clean outdoor condenser coils to restore heat transfer efficiency',lo:95,hi:220,p:72,syn:['clean condenser','condenser coil','coil cleaning','dirty coils','ac not cooling','ac warm air','ac maintenance','condenser clean']},
{t:'HVAC',c:'Labour',n:'Replace AC contactor',d:'Replace failed contactor preventing AC from engaging',lo:145,hi:320,p:72,syn:['contactor','ac contactor','replace contactor','ac not cooling','ac warm air','ac repair','ac not starting']},
{t:'HVAC',c:'Labour',n:'Recharge refrigerant',d:'Test, locate leak if needed, and recharge refrigerant',lo:195,hi:480,p:75,syn:['recharge','refrigerant','freon','r410a','low charge','ac not cooling','ac warm air','not blowing cold','ac blowing warm']},
{t:'HVAC',c:'Labour',n:'Replace AC capacitor',d:'Replace failed run or start capacitor on condenser',lo:120,hi:280,p:78,syn:['capacitor','ac capacitor','run cap','start cap','ac not cooling','ac warm air','humming','ac not starting','ac blowing warm']},

// ── PLUMBER: additional common jobs ──
{t:'Plumber',c:'Labour',n:'Install outdoor kitchen plumbing',d:'Run water supply and drain for outdoor kitchen sink and gas BBQ',lo:450,hi:1200,p:45,syn:['outdoor kitchen','outdoor plumbing','outdoor sink','bbq plumbing','patio sink']},
{t:'Plumber',c:'Labour',n:'Install water heater pan and drain',d:'Install drain pan under water heater with drain line to floor drain',lo:85,hi:195,p:55,syn:['drain pan','water heater pan','overflow pan','water heater install','water heater replace']},
{t:'Plumber',c:'Labour',n:'Replace toilet fill valve and flapper',d:'Replace both fill valve and flapper to fix running toilet',lo:95,hi:195,p:78,syn:['fill valve','flapper','running toilet','toilet running','toilet repair','toilet fix','toilet not stopping','ghost flush']},
{t:'Plumber',c:'Labour',n:'Install frost-free hose bib',d:'Install new frost-free exterior hose bib through wall',lo:195,hi:420,p:62,syn:['hose bib','outdoor faucet','frost free','exterior faucet','garden faucet','hose bib install','outdoor faucet install']},
{t:'Plumber',c:'Labour',n:'Replace tub/shower faucet',d:'Replace 3-handle or single-handle tub/shower faucet valve and trim',lo:280,hi:650,p:68,syn:['tub faucet','shower faucet','tub shower valve','bath faucet','tub valve replace','3 handle faucet']},
{t:'Plumber',c:'Labour',n:'Relocate plumbing for reno',d:'Move supply lines and drain for fixture relocation during renovation',lo:450,hi:1500,p:52,syn:['relocate plumbing','move plumbing','plumbing relocation','reno plumbing','renovation plumbing','fixture relocation']},
{t:'Plumber',c:'Labour',n:'Island sink drain with vent',d:'Island loop vent or AAV install for sink drain in island — code required',lo:350,hi:850,p:48,syn:['island vent','island drain','island loop vent','air admittance valve','aav','island sink plumbing']},
{t:'Plumber',c:'Labour',n:'Extend supply lines to new location',d:'Run new hot and cold supply lines from existing to new fixture position',lo:250,hi:650,p:50,syn:['extend supply','new supply run','supply line extension','run supply lines','pex run']},
{t:'Plumber',c:'Labour',n:'Cap off old plumbing location',d:'Cap and seal existing supply and drain at old fixture location',lo:120,hi:280,p:45,syn:['cap off','cap plumbing','seal old lines','abandon line','cap pipes']},
{t:'Plumber',c:'Labour',n:'Cap off gas line',d:'Disconnect and cap gas line at old appliance location — pressure test after',lo:145,hi:320,p:44,syn:['cap gas','gas cap','gas line cap','disconnect gas','abandon gas line','seal gas line']},
{t:'Plumber',c:'Labour',n:'Remove old galvanized piping',d:'Tear out corroded galvanized supply lines for replacement with copper or PEX',lo:350,hi:950,p:38,syn:['remove galvanized','tear out pipes','old pipes','galvanized removal','pipe demolition']},
{t:'Plumber',c:'Services',n:'Plumbing demolition and disposal',d:'Remove all plumbing fixtures and piping from renovation area — haul away included',lo:250,hi:750,p:40,syn:['plumbing demo','gut plumbing','tear out plumbing','plumbing removal','strip plumbing','haul away']},
{t:'Electrician',c:'Labour',n:'Electrical demolition and strip-out',d:'Remove all wiring, devices, fixtures from renovation area',lo:300,hi:850,p:38,syn:['electrical demo','strip electrical','gut wiring','remove all electrical','electrical strip out']},
{t:'Electrician',c:'Labour',n:'Remove old light fixtures',d:'Disconnect and remove existing light fixtures — cap wires safely',lo:65,hi:165,p:50,syn:['remove lights','remove fixtures','take down lights','old lights']},
{t:'Electrician',c:'Services',n:'Electrical disposal and haul-away',d:'Dispose of old panels, wire, fixtures — proper recycling of electrical materials',lo:95,hi:250,p:35,syn:['electrical disposal','haul away','old panel disposal','wire recycling','fixture disposal']},
{t:'HVAC',c:'Labour',n:'Remove old furnace',d:'Disconnect gas, venting, and electrical — remove furnace from premises',lo:250,hi:650,p:45,syn:['remove furnace','furnace removal','tear out furnace','disconnect furnace','old furnace removal']},
{t:'HVAC',c:'Labour',n:'Remove old ductwork',d:'Tear out existing ductwork from walls, ceiling, or crawlspace — dispose',lo:350,hi:1200,p:38,syn:['remove ductwork','tear out ducts','duct removal','gut ductwork','strip ductwork','old duct removal']},
{t:'HVAC',c:'Labour',n:'Remove baseboard heaters',d:'Disconnect electrical and remove baseboard units from walls — patch drywall holes',lo:45,hi:120,p:42,syn:['remove baseboard','baseboard removal','tear out baseboard','disconnect baseboard']},
{t:'HVAC',c:'Labour',n:'Remove old boiler system',d:'Drain, disconnect, and remove boiler with piping and expansion tank',lo:450,hi:1400,p:35,syn:['remove boiler','boiler removal','decommission boiler','tear out boiler','old boiler']},
{t:'HVAC',c:'Services',n:'HVAC equipment disposal',d:'Haul away and properly dispose of old HVAC equipment — refrigerant recovery if needed',lo:150,hi:450,p:38,syn:['hvac disposal','equipment disposal','haul away','old equipment','refrigerant recovery','dispose furnace','dispose ac']},
{t:'General Contractor',c:'Services',n:'Dumpster rental',d:'Roll-off dumpster for renovation debris — typically 10-20 yard',lo:350,hi:750,p:55,syn:['dumpster','bin rental','debris bin','roll off','waste container','demo bin']},
{t:'General Contractor',c:'Services',n:'Debris haul-away',d:'Load and haul renovation debris to landfill — by truck load',lo:195,hi:550,p:50,syn:['haul away','debris removal','dump run','landfill','garbage removal','construction waste']},
{t:'General Contractor',c:'Labour',n:'Floor protection during demo',d:'Lay protection on finished floors before demolition work begins',lo:85,hi:250,p:42,syn:['floor protection','protect floors','ram board','cardboard protection','demo protection']},
{t:'Plumber',c:'Labour',n:'Floor penetration for drain',d:'Core drill or cut floor for new drain line routing through subfloor or slab',lo:195,hi:550,p:42,syn:['floor penetration','core drill','cut floor','subfloor access','slab penetration','drain through floor']},
{t:'Plumber',c:'Labour',n:'New drain run to stack',d:'Run new ABS/PVC drain from relocated fixture to main drain stack with proper slope',lo:350,hi:900,p:46,syn:['drain run','new drain','drain to stack','drain slope','new waste line','abs run','pvc drain run']},
{t:'Plumber',c:'Materials',n:'Air admittance valve (AAV)',d:'Studor-type vent for island sinks where traditional vent stack is not feasible',lo:25,hi:75,p:40,syn:['aav','studor vent','air admittance','island vent valve','auto vent']},
{t:'Plumber',c:'Labour',n:'Install shut-off valves under sinks',d:'Add or replace individual fixture shutoff valves',lo:85,hi:220,p:65,syn:['shutoff valve','shut off valve','fixture valve','add shutoff','under sink valve','sink shutoff','kitchen shutoff','bathroom shutoff']},
{t:'Plumber',c:'Services',n:'Plumbing rough-in inspection',d:'Prepare for and attend municipal rough-in plumbing inspection',lo:95,hi:250,p:55,syn:['rough-in inspection','plumbing inspection','code inspection','rough in','plumbing permit','inspection']},

// ── ELECTRICIAN: additional common jobs ──
{t:'Electrician',c:'Labour',n:'Install outdoor GFCI outlet',d:'Install weatherproof GFCI outlet on exterior wall or deck',lo:165,hi:350,p:72,syn:['outdoor gfci','outdoor outlet','exterior outlet','deck outlet','patio outlet','weatherproof outlet','outdoor outlet install']},
{t:'Electrician',c:'Labour',n:'Install USB outlet',d:'Replace standard outlet with USB-A/USB-C combo outlet',lo:75,hi:165,p:55,syn:['usb outlet','usb receptacle','charging outlet','usb-c outlet','outlet upgrade']},
{t:'Electrician',c:'Labour',n:'Install whole-home surge protector',d:'Install panel-mount surge protection device',lo:250,hi:450,p:58,syn:['surge protector','whole home surge','panel surge','spd','lightning protection','surge protection']},
{t:'Electrician',c:'Labour',n:'Install electric car pre-wire',d:'Pre-wire garage for future EV charger installation',lo:280,hi:550,p:50,syn:['ev pre-wire','pre-wire','future ev','ev ready','ev charger pre-wire','garage pre-wire']},
{t:'Electrician',c:'Labour',n:'Relocate outlet or switch',d:'Move existing outlet or switch to new location',lo:195,hi:420,p:62,syn:['move outlet','relocate outlet','move switch','relocate switch','outlet relocation']},
{t:'Electrician',c:'Labour',n:'Install recessed outlet for TV',d:'Install recessed outlet and low-voltage plate behind TV mount location',lo:145,hi:320,p:58,syn:['tv outlet','recessed outlet','tv mount outlet','behind tv','media outlet','tv wall mount']},
{t:'Electrician',c:'Labour',n:'Install landscape lighting transformer',d:'Install low-voltage transformer and timer for landscape lights',lo:145,hi:320,p:52,syn:['landscape transformer','low voltage transformer','landscape lighting','garden lighting','path light install']},
{t:'Electrician',c:'Services',n:'Electrical safety inspection',d:'Full electrical safety inspection with written report',lo:195,hi:380,p:58,syn:['safety inspection','electrical inspection','home inspection','panel inspection','wiring inspection']},

// ── HVAC: additional common jobs ──
{t:'HVAC',c:'Labour',n:'Replace draft inducer motor',d:'Remove and replace furnace draft inducer / combustion blower motor',lo:280,hi:550,p:62,syn:['draft inducer','inducer motor','combustion blower','venter motor','furnace repair','furnace noise','noisy furnace']},
{t:'HVAC',c:'Labour',n:'Replace furnace blower wheel',d:'Remove blower assembly, replace blower wheel, and reinstall',lo:250,hi:480,p:55,syn:['blower wheel','furnace wheel','fan wheel','noisy furnace','vibration','furnace noise','squealing']},
{t:'HVAC',c:'Labour',n:'Clean evaporator coil',d:'Access and clean indoor evaporator coil to restore airflow and efficiency',lo:195,hi:380,p:65,syn:['evaporator coil','indoor coil','coil cleaning','dirty coil','frozen coil','ac not cooling','restricted airflow']},
{t:'HVAC',c:'Labour',n:'Clear condensate drain line',d:'Clear clogged condensate drain with vacuum or compressed air',lo:85,hi:195,p:68,syn:['condensate drain','condensate clog','ac leaking water','drain clog','condensate line','ac dripping','water under furnace']},
{t:'HVAC',c:'Labour',n:'Install condensate pump',d:'Install condensate removal pump for furnace or AC unit',lo:145,hi:320,p:55,syn:['condensate pump','condensate removal','pump install','ac condensate','furnace condensate','mini split condensate']},
{t:'HVAC',c:'Labour',n:'Replace thermocouple / pilot assembly',d:'Replace thermocouple or pilot assembly on gas appliance',lo:120,hi:280,p:62,syn:['thermocouple','pilot','pilot assembly','pilot light','gas pilot','standing pilot','furnace pilot','water heater pilot']},
{t:'HVAC',c:'Labour',n:'Install CO detector near furnace',d:'Install hardwired or plug-in CO detector near mechanical room',lo:85,hi:195,p:60,syn:['co detector','carbon monoxide','co alarm','carbon monoxide detector','furnace co','mechanical room','gas detector']},
{t:'HVAC',c:'Labour',n:'Furnace safety inspection',d:'Annual furnace safety check — heat exchanger, CO test, venting, controls',lo:120,hi:250,p:72,syn:['furnace inspection','safety check','furnace safety','annual inspection','furnace check','furnace maintenance','co test']},
{t:'HVAC',c:'Labour',n:'Heat pump diagnostic',d:'Full diagnostic of heat pump system — defrost, refrigerant, reversing valve',lo:135,hi:280,p:75,syn:['heat pump diagnostic','heat pump repair','heat pump not heating','heat pump not cooling','heat pump problem','defrost','reversing valve']},
{t:'HVAC',c:'Labour',n:'Replace heat pump reversing valve',d:'Replace failed reversing valve that controls heat/cool mode switching',lo:450,hi:950,p:45,syn:['reversing valve','heat pump repair','heat pump not heating','stuck in cool','mode switch','heat pump valve']},
{t:'HVAC',c:'Materials',n:'Draft inducer motor',d:'Replacement draft inducer / combustion motor for furnace',lo:150,hi:380,p:52,syn:['inducer motor','draft inducer','combustion motor','venter motor','furnace motor','furnace repair','noisy furnace']},
{t:'HVAC',c:'Materials',n:'CO detector',d:'Carbon monoxide detector — plug-in or hardwired',lo:25,hi:85,p:58,syn:['co detector','carbon monoxide','co alarm','co detector unit','gas detector','furnace co']},
{t:'HVAC',c:'Materials',n:'Condensate pump unit',d:'Condensate removal pump with float switch and tubing',lo:45,hi:150,p:52,syn:['condensate pump','removal pump','condensate pump unit','mini split','furnace','ac condensate']},

// ═══════════════════════════════════════════════════════════════
// 25% EXPANSION — repair/service gap fill + pricing differentiation
// Pricing strategy: 
//   Labour: 1.5-2x spread. Simple=tight ($95-165), complex=wide ($450-1200)
//   Materials: 2-3x spread. Commodity=tight ($8-25), equipment=wide ($350-1200)
//   Services: 1.5x spread. Diagnostic=$135-250, permits=$80-350
// All prices = Alberta baseline. regionalize() applies provincial multipliers.
// ═══════════════════════════════════════════════════════════════

// ── PLUMBER: repair / diagnostic items (+18 labour, +12 materials, +5 services = 35) ──
{t:'Plumber',c:'Labour',n:'Repair leaking shutoff valve',d:'Repack or replace leaking fixture shutoff valve',lo:95,hi:195,p:75,syn:['leaking valve','dripping valve','shutoff leak','valve leak','valve repair','shutoff valve repair']},
{t:'Plumber',c:'Labour',n:'Repair leaking supply line',d:'Replace failed braided supply line at fixture',lo:75,hi:165,p:72,syn:['supply line leak','leaking supply','braided hose leak','connector leak','supply leak','dripping under sink']},
{t:'Plumber',c:'Labour',n:'Repair garbage disposal jam',d:'Clear jammed garburator, reset, and test',lo:85,hi:175,p:68,syn:['garburator jam','disposal jam','jammed disposal','garburator stuck','disposal not working','garburator repair','humming disposal']},
{t:'Plumber',c:'Labour',n:'Adjust toilet tank components',d:'Adjust float, chain, flapper alignment to stop running',lo:65,hi:145,p:72,syn:['running toilet','toilet keeps running','adjust toilet','float adjust','chain adjust','toilet running','ghost flush','toilet not stopping']},
{t:'Plumber',c:'Labour',n:'Repair outdoor faucet leak',d:'Replace cartridge or packing in leaking hose bib',lo:95,hi:220,p:65,syn:['hose bib leak','outdoor faucet leak','exterior faucet drip','hose bib repair','leaking hose bib','dripping outdoor']},
{t:'Plumber',c:'Labour',n:'Tighten loose toilet',d:'Reset loose toilet on flange, add shims, re-caulk base',lo:75,hi:165,p:62,syn:['loose toilet','rocking toilet','wobbly toilet','toilet moves','toilet rocking','toilet not secure']},
{t:'Plumber',c:'Labour',n:'Fix slow drain — bathroom',d:'Clear partial clog in bathroom sink or tub drain',lo:95,hi:220,p:75,syn:['slow drain','sluggish drain','draining slow','bathroom slow drain','tub slow drain','sink slow drain']},
{t:'Plumber',c:'Labour',n:'Repair bathtub drain stopper',d:'Fix or replace bathtub drain stopper mechanism',lo:85,hi:195,p:58,syn:['drain stopper','tub stopper','bath drain stopper','pop up drain','trip lever','lift and turn']},
{t:'Plumber',c:'Labour',n:'Fix noisy pipes',d:'Diagnose and fix water hammer, banging, or whistling pipes',lo:120,hi:280,p:55,syn:['noisy pipes','banging pipes','water hammer','whistling pipes','pipe noise','pipes banging','loud pipes']},
{t:'Plumber',c:'Labour',n:'Replace angle stop valves',d:'Replace under-sink or toilet angle stop shutoff valves',lo:85,hi:195,p:68,syn:['angle stop','angle valve','stop valve','under sink valve','toilet valve','fixture shutoff']},
{t:'Plumber',c:'Labour',n:'Repair dishwasher drain issue',d:'Fix dishwasher not draining — clear clog, check air gap, adjust drain hose',lo:95,hi:220,p:62,syn:['dishwasher not draining','dishwasher clog','dishwasher drain','dishwasher backup','dishwasher standing water']},
{t:'Plumber',c:'Labour',n:'Replace kitchen sprayer',d:'Replace kitchen faucet side sprayer or pull-down hose',lo:65,hi:145,p:58,syn:['kitchen sprayer','pull down hose','spray head','faucet sprayer','faucet hose','side sprayer']},
{t:'Plumber',c:'Labour',n:'Install anti-scald valve',d:'Install thermostatic mixing valve at water heater or shower',lo:195,hi:420,p:52,syn:['anti-scald','mixing valve','thermostatic valve','scald protection','tmv install','tempering valve']},
{t:'Plumber',c:'Labour',n:'Replace toilet seat',d:'Remove old and install new toilet seat with hardware',lo:35,hi:85,p:55,syn:['toilet seat','seat replace','bidet seat install','soft close seat','new toilet seat']},
{t:'Plumber',c:'Labour',n:'Install washing machine shutoffs',d:'Install quarter-turn shutoff valves for washing machine',lo:120,hi:265,p:62,syn:['washer shutoff','washing machine valve','laundry valve','quarter turn','washer valve install']},
{t:'Plumber',c:'Labour',n:'Water heater element replacement',d:'Replace upper or lower heating element in electric water heater',lo:145,hi:310,p:62,syn:['water heater element','element replace','electric water heater repair','no hot water electric','heating element']},
{t:'Plumber',c:'Labour',n:'Flush water heater tank',d:'Drain and flush sediment from water heater tank',lo:95,hi:195,p:58,syn:['flush water heater','flush tank','drain water heater','sediment flush','water heater maintenance','tank flush']},
{t:'Plumber',c:'Labour',n:'Test and certify backflow',d:'Annual backflow preventer test with certification',lo:75,hi:175,p:62,syn:['backflow test','annual test','rpz test','backflow certification','backflow certify']},
{t:'Plumber',c:'Materials',n:'Angle stop valves (pair)',d:'Quarter-turn angle stop shutoff valves — hot and cold',lo:15,hi:45,p:65,syn:['angle stop','angle valve','shutoff valve','stop valve','fixture valve','under sink valve']},
{t:'Plumber',c:'Materials',n:'Water hammer arrestor',d:'Mini rester or piston-type water hammer arrestor',lo:15,hi:55,p:50,syn:['water hammer','arrestor','hammer arrestor','pipe noise','banging pipes']},
{t:'Plumber',c:'Materials',n:'Kitchen faucet sprayer head',d:'Replacement pull-down spray head or side sprayer',lo:15,hi:65,p:48,syn:['spray head','sprayer head','pull down spray','side sprayer','kitchen sprayer']},
{t:'Plumber',c:'Materials',n:'Toilet seat',d:'Standard or soft-close toilet seat — round or elongated',lo:25,hi:95,p:55,syn:['toilet seat','soft close seat','elongated seat','round seat']},
{t:'Plumber',c:'Materials',n:'Electric water heater element',d:'Upper or lower screw-in element for electric tank',lo:15,hi:45,p:52,syn:['heating element','water heater element','electric element','screw-in element']},
{t:'Plumber',c:'Materials',n:'Hose bib repair kit',d:'Cartridge, packing, washers for hose bib repair',lo:8,hi:30,p:48,syn:['hose bib kit','repair kit','faucet washers','packing','hose bib repair','outdoor faucet repair']},
{t:'Plumber',c:'Materials',n:'Drain stopper mechanism',d:'Bathtub drain stopper — trip lever, push-pull, or lift-and-turn',lo:15,hi:55,p:48,syn:['drain stopper','tub stopper','trip lever','push pull','lift turn','bath drain stopper']},
{t:'Plumber',c:'Materials',n:'Dishwasher air gap',d:'Air gap device for dishwasher drain anti-siphon',lo:12,hi:35,p:45,syn:['air gap','dishwasher air gap','anti-siphon','dishwasher drain']},
{t:'Plumber',c:'Materials',n:'Pipe repair clamp',d:'Emergency pipe repair clamp or compression sleeve',lo:8,hi:35,p:52,syn:['repair clamp','pipe clamp','compression sleeve','emergency clamp','pipe fix','leak clamp']},
{t:'Plumber',c:'Materials',n:'Toilet repair kit',d:'Complete toilet repair kit — fill valve, flapper, gaskets, and hardware',lo:18,hi:45,p:60,syn:['toilet repair kit','toilet kit','repair kit','fill valve','flapper','toilet hardware','toilet internals','running toilet']},
{t:'Plumber',c:'Materials',n:'Anti-scald mixing valve',d:'Thermostatic mixing valve for water heater output',lo:55,hi:165,p:48,syn:['mixing valve','anti-scald valve','tmv','tempering valve','scald valve']},
{t:'Plumber',c:'Materials',n:'Water heater drain valve',d:'Replacement drain valve or hose bib for tank drain',lo:8,hi:25,p:45,syn:['drain valve','water heater drain','tank drain','hose bib','flush valve']},
{t:'Plumber',c:'Services',n:'Emergency plumbing call',d:'After-hours or emergency plumbing service call',lo:195,hi:395,p:72,syn:['emergency','emergency plumber','after hours','urgent','flooding','burst pipe','emergency call']},
{t:'Plumber',c:'Services',n:'Water quality test',d:'Test water for hardness, pH, iron, bacteria',lo:85,hi:195,p:42,syn:['water test','water quality','hardness test','water analysis','well water test']},
{t:'Plumber',c:'Services',n:'Plumbing code review',d:'Review existing plumbing against current code requirements',lo:120,hi:280,p:42,syn:['code review','code compliance','plumbing code','bring to code','inspection prep']},
{t:'Plumber',c:'Services',n:'Video drain inspection',d:'Camera scope drain or sewer line with recorded video',lo:195,hi:420,p:68,syn:['video inspection','camera scope','drain camera','sewer camera','pipe camera','recorded inspection']},
{t:'Plumber',c:'Services',n:'Plumbing maintenance visit',d:'Annual plumbing maintenance — check valves, water heater, drains, fixtures',lo:145,hi:295,p:55,syn:['annual maintenance','plumbing maintenance','maintenance visit','plumbing check','preventive maintenance']},

// ── ELECTRICIAN: repair / diagnostic / service items (+20 labour, +14 materials, +6 services = 40) ──
{t:'Electrician',c:'Labour',n:'Repair dead outlet',d:'Diagnose and repair outlet with no power — loose wire, tripped breaker, or failed device',lo:95,hi:220,p:82,syn:['dead outlet','outlet not working','no power outlet','outlet repair','outlet dead','receptacle dead']},
{t:'Electrician',c:'Labour',n:'Repair flickering lights',d:'Diagnose and fix flickering — loose connection, faulty fixture, or overloaded circuit',lo:95,hi:250,p:78,syn:['flickering light','lights flicker','flicker','dimming light','intermittent','light going on and off','light repair']},
{t:'Electrician',c:'Labour',n:'Fix buzzing switch or outlet',d:'Diagnose buzzing — replace device, tighten connections, or fix dimmer compatibility',lo:85,hi:195,p:68,syn:['buzzing outlet','buzzing switch','humming outlet','vibrating switch','arcing','electrical noise','buzzing']},
{t:'Electrician',c:'Labour',n:'Repair outdoor GFCI tripping',d:'Diagnose and repair GFCI that keeps tripping — moisture, ground fault, or wiring issue',lo:95,hi:250,p:72,syn:['gfci tripping','gfci keeps tripping','outdoor gfci','ground fault','gfci trip','gfci reset','exterior gfci']},
{t:'Electrician',c:'Labour',n:'Replace burned outlet',d:'Replace outlet showing scorch marks, melting, or heat damage',lo:95,hi:220,p:75,syn:['burned outlet','scorched outlet','melted outlet','hot outlet','burnt outlet','discolored outlet','outlet fire']},
{t:'Electrician',c:'Labour',n:'Repair non-working light switch',d:'Diagnose and repair or replace failed switch',lo:75,hi:165,p:72,syn:['switch not working','dead switch','switch repair','light wont turn on','switch broken','bad switch']},
{t:'Electrician',c:'Labour',n:'Fix half-hot outlet',d:'Diagnose or configure split-wired (half-hot) outlet',lo:85,hi:195,p:55,syn:['half hot','split outlet','half outlet not working','switched outlet','half dead outlet']},
{t:'Electrician',c:'Labour',n:'Repair doorbell not working',d:'Diagnose and fix doorbell — transformer, wiring, or button',lo:85,hi:195,p:55,syn:['doorbell not working','doorbell broken','no doorbell','doorbell repair','chime not working']},
{t:'Electrician',c:'Labour',n:'Install arc fault breaker',d:'Replace standard breaker with AFCI for code compliance',lo:120,hi:250,p:55,syn:['arc fault','afci install','afci upgrade','bedroom breaker','code compliance','afci breaker install']},
{t:'Electrician',c:'Labour',n:'Upgrade 2-prong to 3-prong outlets',d:'Replace ungrounded 2-prong outlets with grounded 3-prong',lo:85,hi:195,p:62,syn:['2 prong','ungrounded','two prong','upgrade outlet','ground outlet','old outlet','3 prong']},
{t:'Electrician',c:'Labour',n:'Install timer for bathroom fan',d:'Install countdown or humidity-sensing timer for exhaust fan',lo:85,hi:175,p:58,syn:['fan timer','bathroom timer','humidity timer','countdown timer','exhaust timer','bathroom fan timer']},
{t:'Electrician',c:'Labour',n:'Install motion sensor switch',d:'Replace standard switch with motion/occupancy sensor switch',lo:85,hi:175,p:55,syn:['motion sensor','occupancy sensor','motion switch','auto light','motion sensor switch']},
{t:'Electrician',c:'Labour',n:'Install smart outlet',d:'Install WiFi-enabled smart outlet or switch',lo:85,hi:175,p:48,syn:['smart outlet','wifi outlet','smart plug','smart switch install','connected outlet']},
{t:'Electrician',c:'Labour',n:'Add circuit for microwave',d:'Run dedicated 20A circuit for over-the-range microwave',lo:250,hi:480,p:62,syn:['microwave circuit','dedicated microwave','microwave outlet','otr microwave','above range']},
{t:'Electrician',c:'Labour',n:'Add circuit for dishwasher',d:'Run dedicated circuit for dishwasher with junction box or outlet',lo:250,hi:480,p:62,syn:['dishwasher circuit','dishwasher wiring','dishwasher electrical','dedicated dishwasher']},
{t:'Electrician',c:'Labour',n:'Install attic light and outlet',d:'Wire and install light fixture and outlet in attic space',lo:195,hi:380,p:48,syn:['attic light','attic outlet','attic wiring','attic electrical']},
{t:'Electrician',c:'Labour',n:'Install closet light',d:'Install code-compliant closet light fixture',lo:95,hi:220,p:52,syn:['closet light','closet fixture','closet led','closet wiring']},
{t:'Electrician',c:'Labour',n:'Run speaker wire',d:'Run in-wall or in-ceiling speaker wire for audio system',lo:95,hi:250,p:42,syn:['speaker wire','audio wire','speaker cable','in-wall speaker','ceiling speaker','surround sound']},
{t:'Electrician',c:'Labour',n:'Install whole-home audio pre-wire',d:'Pre-wire multiple rooms for built-in speakers and volume controls',lo:450,hi:1200,p:35,syn:['whole home audio','pre-wire audio','speaker pre-wire','audio system','distributed audio']},
{t:'Electrician',c:'Labour',n:'Repair aluminum wiring connection',d:'Pigtail or remediate single aluminum wiring connection point',lo:65,hi:145,p:55,syn:['aluminum wire','pigtail','aluminium','aluminum connection','aluminum repair','copalum','alumiconn']},
{t:'Electrician',c:'Materials',n:'Motion/occupancy sensor switch',d:'Motion sensor or vacancy sensor wall switch — Lutron, Leviton',lo:20,hi:55,p:52,syn:['motion sensor','occupancy sensor','vacancy sensor','auto switch','motion switch']},
{t:'Electrician',c:'Materials',n:'Smart outlet/switch',d:'WiFi smart outlet or switch — TP-Link, Lutron, Wemo',lo:25,hi:65,p:48,syn:['smart outlet','smart switch','wifi outlet','wifi switch','connected device']},
{t:'Electrician',c:'Materials',n:'Timer switch (fan/light)',d:'Countdown or programmable timer switch for fan or light',lo:15,hi:55,p:55,syn:['timer switch','countdown timer','fan timer','programmable timer','bath timer']},
{t:'Electrician',c:'Materials',n:'Weatherproof outlet cover',d:'In-use weatherproof cover for exterior outlet',lo:8,hi:25,p:55,syn:['weatherproof cover','in-use cover','outdoor cover','wp cover','exterior outlet cover','outdoor outlet']},
{t:'Electrician',c:'Materials',n:'Aluminum pigtail connectors',d:'AlumiConn or approved AL/CU connectors for aluminum wiring remediation',lo:5,hi:15,p:52,syn:['alumiconn','pigtail','aluminum connector','al-cu connector','aluminum wire','aluminum remediation']},
{t:'Electrician',c:'Materials',n:'GFCI outlet device',d:'Ground fault circuit interrupter outlet — 15A or 20A',lo:15,hi:35,p:68,syn:['gfci outlet','gfci device','gfi outlet','ground fault outlet','gfci','bathroom outlet','kitchen outlet','exterior outlet']},
{t:'Electrician',c:'Materials',n:'Arc fault breaker (AFCI)',d:'AFCI breaker for bedroom and living area circuits — code required',lo:35,hi:75,p:55,syn:['afci breaker','arc fault breaker','bedroom breaker','afci','arc fault']},
{t:'Electrician',c:'Materials',n:'Closet light fixture',d:'LED closet light — surface mount or recessed, code-compliant',lo:15,hi:55,p:48,syn:['closet light','closet fixture','closet led','surface mount','code closet']},
{t:'Electrician',c:'Materials',n:'Attic light and outlet',d:'Porcelain lampholder and outlet for attic access area',lo:10,hi:35,p:42,syn:['attic light','attic outlet','porcelain lamp','attic fixture']},
{t:'Electrician',c:'Materials',n:'Speaker wire',d:'In-wall rated speaker cable — 14/2 or 16/2',lo:15,hi:55,p:38,syn:['speaker wire','speaker cable','audio wire','in-wall speaker','cl2 wire']},
{t:'Electrician',c:'Materials',n:'Wire staples and supports',d:'Romex staples, cable ties, wire supports, and bushings',lo:5,hi:20,p:60,syn:['wire staple','cable tie','wire support','bushing','cable management','romex staple']},
{t:'Electrician',c:'Materials',n:'Extension ring / box extender',d:'Box extender ring for deep-set or flush outlet/switch boxes',lo:3,hi:12,p:48,syn:['box extender','extension ring','box extension','deep box','proud box','outlet box']},
{t:'Electrician',c:'Materials',n:'Cable connector / clamp',d:'Romex connector, cable clamp, or NM connector for box entry',lo:3,hi:12,p:55,syn:['cable connector','romex connector','nm connector','cable clamp','box connector']},
{t:'Electrician',c:'Materials',n:'Wire nuts (assorted)',d:'Assorted wire nuts / marrettes — tan, red, yellow',lo:5,hi:15,p:65,syn:['wire nut','marrette','wire connector','twist connector','wire splice']},
{t:'Electrician',c:'Services',n:'Load calculation',d:'Calculate total electrical load for panel sizing or permit',lo:195,hi:380,p:48,syn:['load calculation','load calc','panel sizing','electrical load','load study']},
{t:'Electrician',c:'Services',n:'Electrical permit pull',d:'Pull municipal electrical permit and coordinate inspection',lo:120,hi:350,p:55,syn:['electrical permit','permit pull','pull permit','inspection','code inspection','esa']},
{t:'Electrician',c:'Services',n:'Emergency electrical call',d:'After-hours or emergency electrical service',lo:195,hi:395,p:65,syn:['emergency','emergency electrician','after hours','urgent','power out','sparking','electrical fire']},
{t:'Electrician',c:'Services',n:'Pre-purchase electrical inspection',d:'Electrical inspection for home purchase with written report',lo:195,hi:380,p:52,syn:['home inspection','pre-purchase','electrical inspection','home buyer','house inspection']},
{t:'Electrician',c:'Services',n:'Insurance claim documentation',d:'Document electrical damage and scope for insurance claim',lo:150,hi:320,p:42,syn:['insurance','insurance claim','damage documentation','electrical damage','lightning damage','fire damage']},
{t:'Electrician',c:'Services',n:'Electrical consultation',d:'On-site consultation for renovation, addition, or upgrade planning',lo:95,hi:220,p:58,syn:['consultation','electrical consultation','planning','renovation electrical','design','estimate']},

// ── HVAC: repair / diagnostic / service items (+18 labour, +14 materials, +8 services = 40) ──
{t:'HVAC',c:'Labour',n:'Repair furnace inducer motor',d:'Diagnose and replace failed draft inducer motor',lo:280,hi:550,p:65,syn:['inducer motor','draft inducer','inducer repair','furnace inducer','combustion blower','furnace noise']},
{t:'HVAC',c:'Labour',n:'Replace flame rollout switch',d:'Replace tripped or failed flame rollout safety switch',lo:95,hi:220,p:60,syn:['rollout switch','flame rollout','safety switch','furnace lockout','rollout limit','furnace safety']},
{t:'HVAC',c:'Labour',n:'Replace furnace limit switch',d:'Replace high-limit temperature safety switch',lo:95,hi:220,p:58,syn:['limit switch','high limit','temperature switch','furnace limit','safety limit','furnace overheating']},
{t:'HVAC',c:'Labour',n:'Repair AC fan motor',d:'Diagnose and replace failed condenser fan motor',lo:250,hi:480,p:62,syn:['fan motor','condenser fan','ac fan','ac fan motor','outdoor fan','fan not spinning','ac fan repair']},
{t:'HVAC',c:'Labour',n:'Replace AC fan blade',d:'Replace damaged or unbalanced condenser fan blade',lo:65,hi:165,p:48,syn:['fan blade','condenser blade','ac fan blade','noisy ac','vibrating condenser']},
{t:'HVAC',c:'Labour',n:'Repair refrigerant leak',d:'Locate and repair refrigerant leak — braze, sealant, or replace component',lo:280,hi:650,p:60,syn:['refrigerant leak','freon leak','ac leak','leak repair','r410a leak','low charge','ac not cooling']},
{t:'HVAC',c:'Labour',n:'Replace TXV / expansion valve',d:'Replace thermostatic expansion valve on evaporator',lo:350,hi:750,p:48,syn:['txv','expansion valve','thermostatic valve','txv replace','metering device','ac not cooling']},
{t:'HVAC',c:'Labour',n:'Clean and adjust burners',d:'Clean furnace burners, adjust air/gas mixture, verify flame',lo:120,hi:250,p:62,syn:['clean burner','burner adjustment','furnace burner','flame adjustment','yellow flame','dirty burner']},
{t:'HVAC',c:'Labour',n:'Replace gas flex connector',d:'Replace flexible gas connector to furnace or appliance',lo:85,hi:195,p:55,syn:['gas flex','gas connector','flex connector','furnace gas','appliance connector','gas line']},
{t:'HVAC',c:'Labour',n:'Install duct register / grille',d:'Cut opening and install supply register or return grille',lo:65,hi:165,p:58,syn:['register','grille','vent','supply register','return grille','floor register','ceiling register','duct register']},
{t:'HVAC',c:'Labour',n:'Replace filter rack / cabinet',d:'Install or replace furnace filter rack for standard or 4-inch filter',lo:95,hi:220,p:52,syn:['filter rack','filter cabinet','filter slot','4 inch filter','filter housing','furnace filter rack']},
{t:'HVAC',c:'Labour',n:'Repair zone valve',d:'Diagnose and replace failed zone valve on hydronic system',lo:195,hi:420,p:48,syn:['zone valve','zone valve repair','hydronic valve','zone control','boiler valve','zone actuator']},
{t:'HVAC',c:'Labour',n:'Replace expansion tank (HVAC)',d:'Replace failed expansion tank on hydronic heating system',lo:145,hi:320,p:48,syn:['expansion tank','hydronic tank','boiler tank','pressure tank','expansion tank replace']},
{t:'HVAC',c:'Labour',n:'Install CO detector / alarm',d:'Install carbon monoxide detector near furnace or mechanical room',lo:65,hi:155,p:60,syn:['co detector install','carbon monoxide alarm','co alarm install','furnace safety','mechanical room']},
{t:'HVAC',c:'Labour',n:'Seal and insulate attic ductwork',d:'Seal joints and add insulation to attic duct runs',lo:350,hi:850,p:48,syn:['attic duct','insulate attic duct','seal attic duct','attic insulation','duct in attic','duct insulation']},
{t:'HVAC',c:'Labour',n:'Install return air grille',d:'Cut opening and install new return air grille in wall or ceiling',lo:120,hi:280,p:52,syn:['return air','return grille','return vent','cold air return','air return','return air install']},
{t:'HVAC',c:'Labour',n:'Replace outdoor disconnect',d:'Replace failed AC or heat pump outdoor electrical disconnect',lo:120,hi:265,p:52,syn:['outdoor disconnect','ac disconnect','disconnect replace','heat pump disconnect','fused disconnect']},
{t:'HVAC',c:'Labour',n:'Test and adjust gas pressure',d:'Measure and adjust manifold gas pressure on furnace or boiler',lo:95,hi:195,p:55,syn:['gas pressure','manifold pressure','gas adjustment','pressure test','furnace gas','flame adjustment']},
{t:'HVAC',c:'Materials',n:'Flame rollout switch',d:'Bimetal flame rollout limit switch for furnace',lo:12,hi:35,p:52,syn:['rollout switch','flame rollout','rollout limit','safety switch','furnace safety']},
{t:'HVAC',c:'Materials',n:'Furnace limit switch',d:'High-limit temperature switch for furnace safety circuit',lo:12,hi:35,p:52,syn:['limit switch','high limit','temperature limit','furnace limit','safety switch']},
{t:'HVAC',c:'Materials',n:'AC contactor',d:'Single or double-pole contactor for condenser unit',lo:18,hi:55,p:60,syn:['contactor','ac contactor','condenser contactor','relay','single pole','double pole']},
{t:'HVAC',c:'Materials',n:'Condenser fan motor',d:'Replacement condenser fan motor with capacitor',lo:120,hi:320,p:52,syn:['condenser fan','fan motor','outdoor fan motor','ac fan motor','condenser motor']},
{t:'HVAC',c:'Materials',n:'Condenser fan blade',d:'Replacement condenser fan blade — matched to motor',lo:15,hi:45,p:45,syn:['fan blade','condenser blade','replacement blade','ac fan blade']},
{t:'HVAC',c:'Materials',n:'TXV / expansion valve',d:'Thermostatic expansion valve matched to system tonnage',lo:85,hi:250,p:42,syn:['txv','expansion valve','metering valve','thermostatic valve']},
{t:'HVAC',c:'Materials',n:'Gas flex connector (HVAC)',d:'Flexible gas connector with shutoff for furnace connection',lo:18,hi:55,p:55,syn:['gas flex','gas connector','furnace connector','appliance connector','gas line']},
{t:'HVAC',c:'Materials',n:'Register / grille',d:'Supply register or return air grille — standard sizes',lo:8,hi:35,p:60,syn:['register','grille','vent cover','supply register','return grille','air vent','floor register','ceiling register']},
{t:'HVAC',c:'Materials',n:'Filter (standard 1-inch)',d:'Standard 1-inch furnace filter — fibreglass or pleated',lo:5,hi:18,p:70,syn:['furnace filter','1 inch filter','pleated filter','air filter','standard filter','hvac filter','filter replacement']},
{t:'HVAC',c:'Materials',n:'Filter (4-inch high-capacity)',d:'4-inch high-efficiency furnace filter — MERV 11-13',lo:25,hi:65,p:58,syn:['4 inch filter','high capacity filter','merv 11','merv 13','deep filter','media filter','high efficiency filter']},
{t:'HVAC',c:'Materials',n:'Zone valve',d:'Motorized zone valve for hydronic heating system',lo:65,hi:195,p:45,syn:['zone valve','motorized valve','zone control valve','honeywell zone','taco zone','boiler valve']},
{t:'HVAC',c:'Materials',n:'Expansion tank (hydronic)',d:'Diaphragm expansion tank for hydronic boiler system',lo:35,hi:120,p:45,syn:['expansion tank','hydronic tank','diaphragm tank','boiler expansion','pressure tank']},
{t:'HVAC',c:'Materials',n:'Outdoor disconnect box',d:'Fused or non-fused disconnect for AC or heat pump',lo:25,hi:75,p:52,syn:['disconnect','outdoor disconnect','ac disconnect','fused disconnect','pullout disconnect']},
{t:'HVAC',c:'Materials',n:'Thermostat batteries',d:'AA or AAA batteries for thermostat',lo:3,hi:10,p:55,syn:['thermostat battery','batteries','thermostat batteries','aa battery']},
{t:'HVAC',c:'Services',n:'Emergency HVAC call',d:'After-hours or emergency heating/cooling service call',lo:195,hi:425,p:68,syn:['emergency','emergency hvac','after hours','urgent','no heat emergency','furnace emergency']},
{t:'HVAC',c:'Services',n:'HVAC maintenance plan',d:'Annual maintenance plan — fall furnace + spring AC tune-up',lo:250,hi:450,p:55,syn:['maintenance plan','annual plan','service plan','preventive maintenance','maintenance agreement']},
{t:'HVAC',c:'Services',n:'Duct leakage test',d:'Pressurize and measure duct leakage with report',lo:195,hi:380,p:42,syn:['duct test','duct leakage','duct pressure','blower door','duct tightness','duct audit']},
{t:'HVAC',c:'Services',n:'Combustion analysis',d:'Test furnace combustion efficiency and CO levels with analyzer',lo:120,hi:250,p:55,syn:['combustion analysis','combustion test','co test','efficiency test','flue analysis','furnace test']},
{t:'HVAC',c:'Services',n:'HVAC permit pull',d:'Pull mechanical permit for HVAC equipment installation',lo:95,hi:295,p:52,syn:['hvac permit','mechanical permit','permit pull','equipment permit','installation permit']},
{t:'HVAC',c:'Services',n:'Second opinion / assessment',d:'Independent assessment of HVAC system or previous repair quote',lo:135,hi:280,p:48,syn:['second opinion','assessment','independent assessment','system review','quote review']},
{t:'HVAC',c:'Services',n:'Indoor air quality test',d:'Measure CO2, humidity, particles, and VOCs with report',lo:195,hi:420,p:38,syn:['air quality','iaq','air test','indoor air','air quality test','voc test','humidity test']},
{t:'HVAC',c:'Services',n:'Pre-purchase HVAC inspection',d:'Inspect HVAC system age, condition, and remaining life for home buyer',lo:195,hi:380,p:45,syn:['home inspection','pre-purchase','hvac inspection','system age','remaining life','home buyer']},

// ═══════════════════════════════════════════════════════════════
// COMMERCIAL — Plumber
// ═══════════════════════════════════════════════════════════════
{t:'Plumber',c:'Labour',n:'Install grease trap',d:'Install under-sink or in-ground grease interceptor for commercial kitchen',lo:680,hi:1800,p:88,syn:['grease trap','grease interceptor','restaurant plumbing','commercial kitchen trap','grease interceptor install']},
{t:'Plumber',c:'Labour',n:'Grease trap cleaning and service',d:'Pump out and clean existing grease trap, inspect baffles',lo:280,hi:550,p:72,syn:['grease trap cleaning','pump grease trap','grease trap service','trap pumping']},
{t:'Plumber',c:'Labour',n:'Install urinal',d:'Install wall-mount urinal with flush valve and drain connection',lo:380,hi:750,p:65,syn:['urinal','urinal install','wall urinal','flush valve urinal','washroom urinal']},
{t:'Plumber',c:'Labour',n:'Replace urinal flush valve',d:'Replace manual or sensor flush valve on existing urinal',lo:180,hi:380,p:58,syn:['urinal flush valve','flushometer','sloan valve','urinal repair','sensor flush']},
{t:'Plumber',c:'Materials',n:'Urinal unit',d:'Wall-mount urinal with mounting hardware',lo:250,hi:650,p:55,syn:['urinal','wall mount urinal','commercial urinal']},
{t:'Plumber',c:'Materials',n:'Urinal flush valve',d:'Manual or sensor flushometer valve',lo:120,hi:420,p:50,syn:['flushometer','flush valve','sloan','sensor flush valve']},
{t:'Plumber',c:'Labour',n:'Install commercial water heater',d:'Install high-capacity gas or electric commercial water heater (75+ gallon)',lo:1200,hi:2800,p:72,syn:['commercial water heater','large water heater','100 gallon','75 gallon','high capacity water heater']},
{t:'Plumber',c:'Labour',n:'Install booster pump',d:'Install water pressure booster pump for multi-story commercial building',lo:950,hi:2200,p:58,syn:['booster pump','pressure booster','water booster','building booster pump','multi story pump','water pressure pump']},
{t:'Plumber',c:'Materials',n:'Booster pump unit',d:'Commercial water pressure booster pump assembly',lo:800,hi:2400,p:48,syn:['booster pump','pressure booster pump','pump assembly']},
{t:'Plumber',c:'Labour',n:'Install eye wash station',d:'Install emergency eye wash and shower station with drainage',lo:450,hi:950,p:52,syn:['eye wash','eye wash station','emergency shower','safety shower','emergency eye wash','warehouse safety']},
{t:'Plumber',c:'Materials',n:'Eye wash station unit',d:'Emergency eye wash / shower combo station',lo:350,hi:1200,p:45,syn:['eye wash unit','emergency shower unit','safety station']},
{t:'Plumber',c:'Labour',n:'Commercial washroom rough-in',d:'Rough-in plumbing for commercial washroom — toilets, sinks, urinals',lo:1800,hi:4500,p:68,syn:['washroom rough in','commercial bathroom rough in','tenant washroom','rough in plumbing','commercial rough in']},
{t:'Plumber',c:'Labour',n:'Install floor drain',d:'Cut concrete if needed, install floor drain with trap and tie to waste',lo:480,hi:1200,p:62,syn:['floor drain','commercial floor drain','drain install','concrete floor drain']},
{t:'Plumber',c:'Labour',n:'Backflow preventer annual test',d:'Annual test and certification of RPZ or DCVA backflow device',lo:120,hi:280,p:82,syn:['backflow test','annual backflow','rpz test','dcva test','backflow certification','cross connection']},
{t:'Plumber',c:'Labour',n:'Install commercial dishwasher hookup',d:'Connect water supply, waste, and indirect drain for commercial dishwasher',lo:380,hi:850,p:55,syn:['commercial dishwasher','dishwasher hookup','restaurant dishwasher','indirect drain']},
{t:'Plumber',c:'Services',n:'Commercial plumbing permit',d:'Pull plumbing permit for commercial work',lo:150,hi:450,p:65,syn:['commercial permit','plumbing permit','permit commercial']},

// ═══════════════════════════════════════════════════════════════
// COMMERCIAL — Electrician
// ═══════════════════════════════════════════════════════════════
{t:'Electrician',c:'Labour',n:'Install three-phase power',d:'Run three-phase service and connect distribution panel for commercial equipment',lo:2800,hi:6500,p:62,syn:['three phase','3 phase','three phase power','commercial power','3 phase service','industrial power']},
{t:'Electrician',c:'Labour',n:'Three-phase panel install',d:'Install three-phase distribution panel and connect circuits',lo:1800,hi:4200,p:58,syn:['three phase panel','3 phase panel','distribution panel','commercial panel']},
{t:'Electrician',c:'Materials',n:'Three-phase distribution panel',d:'Three-phase commercial distribution panel with breakers',lo:1200,hi:3500,p:48,syn:['3 phase panel','distribution panel','commercial panel']},
{t:'Electrician',c:'Labour',n:'Install emergency lighting',d:'Install battery-backed emergency light units per building code',lo:180,hi:380,p:78,syn:['emergency lighting','emergency light','battery backup light','egress lighting','emergency lamp']},
{t:'Electrician',c:'Materials',n:'Emergency light unit',d:'LED emergency light with battery backup and test switch',lo:85,hi:250,p:72,syn:['emergency light','battery light','egress light']},
{t:'Electrician',c:'Labour',n:'Install exit signs',d:'Install illuminated exit signs with battery backup per code',lo:150,hi:320,p:78,syn:['exit sign','exit light','illuminated exit','led exit sign','egress sign']},
{t:'Electrician',c:'Materials',n:'LED exit sign',d:'LED exit sign with battery backup',lo:45,hi:150,p:75,syn:['exit sign','led exit','exit light']},
{t:'Electrician',c:'Labour',n:'Fire alarm panel install',d:'Install addressable fire alarm panel, connect devices, and program',lo:2200,hi:5500,p:55,syn:['fire alarm','fire alarm panel','fire alarm system','addressable panel','alarm panel']},
{t:'Electrician',c:'Labour',n:'Fire alarm device install (each)',d:'Install and wire smoke detector, heat detector, or pull station to panel',lo:120,hi:280,p:68,syn:['smoke detector commercial','heat detector','pull station','fire alarm device','alarm device']},
{t:'Electrician',c:'Labour',n:'Install parking lot lighting',d:'Install LED pole-mount or wall-pack lights in parking area',lo:450,hi:1200,p:58,syn:['parking lot lights','parking lot lighting','pole light','wall pack','exterior commercial lighting','led parking light']},
{t:'Electrician',c:'Materials',n:'LED wall pack light',d:'Commercial LED wall pack fixture for exterior',lo:120,hi:350,p:55,syn:['wall pack','exterior light','commercial exterior','led wall pack']},
{t:'Electrician',c:'Materials',n:'LED pole light fixture',d:'LED parking lot pole-mount fixture',lo:280,hi:750,p:48,syn:['pole light','parking light','lot light','pole fixture']},
{t:'Electrician',c:'Labour',n:'Tenant space electrical rough-in',d:'Run circuits, outlets, and lighting for new commercial tenant space',lo:2500,hi:6000,p:62,syn:['tenant electrical','tenant space','tenant improvement electrical','commercial rough in','strip mall wiring','tenant wiring']},
{t:'Electrician',c:'Labour',n:'Install data cabling (per drop)',d:'Run and terminate Cat6 cable from patch panel to outlet',lo:150,hi:320,p:72,syn:['data cabling','cat6','cat 6','ethernet','network cable','data drop','network drop','data run']},
{t:'Electrician',c:'Materials',n:'Cat6 cable and terminations (per drop)',d:'Cat6 cable, keystone jack, faceplate, and patch panel port',lo:35,hi:80,p:68,syn:['cat6 cable','cat6 materials','network cable','ethernet cable']},
{t:'Electrician',c:'Labour',n:'Commercial generator hookup',d:'Install transfer switch and connect standby generator to commercial panel',lo:1800,hi:4500,p:55,syn:['commercial generator','standby generator','generator hookup','transfer switch commercial','generator install commercial']},
{t:'Electrician',c:'Labour',n:'Install security camera system',d:'Install IP cameras, run cabling, configure NVR or cloud recorder',lo:1200,hi:3500,p:62,syn:['security cameras','ip camera','cctv','camera system','surveillance','nvr','security system cameras']},
{t:'Electrician',c:'Materials',n:'IP camera with mount',d:'Commercial IP security camera with weatherproof housing and mount',lo:150,hi:450,p:58,syn:['ip camera','security camera','poe camera','surveillance camera']},
{t:'Electrician',c:'Labour',n:'Install commercial signage power',d:'Run dedicated circuit for exterior or interior commercial signage',lo:350,hi:750,p:52,syn:['sign power','signage electrical','commercial sign','storefront sign power','neon sign power']},
{t:'Electrician',c:'Services',n:'Commercial electrical permit',d:'Pull electrical permit for commercial work',lo:150,hi:450,p:68,syn:['commercial permit','electrical permit','permit commercial']},
{t:'Electrician',c:'Labour',n:'Electrical code upgrade commercial',d:'Bring existing commercial wiring up to current code requirements',lo:1500,hi:5000,p:52,syn:['code upgrade','commercial code','electrical upgrade','code compliance','bring to code']},

// ═══════════════════════════════════════════════════════════════
// COMMERCIAL — General Contractor
// ═══════════════════════════════════════════════════════════════
{t:'General Contractor',c:'Labour',n:'Tenant improvement buildout',d:'Full buildout of commercial tenant space — framing, drywall, doors, flooring, paint',lo:25,hi:65,p:72,syn:['tenant improvement','tenant buildout','ti buildout','commercial buildout','leasehold improvement','tenant fit out','tenant space']},
{t:'General Contractor',c:'Labour',n:'Install partition walls',d:'Frame and drywall interior partition walls for office layout',lo:12,hi:28,p:78,syn:['partition wall','office wall','divider wall','demising wall','interior wall','office partition','partition framing']},
{t:'General Contractor',c:'Labour',n:'Install drop ceiling',d:'Install suspended T-bar ceiling grid with acoustic tiles',lo:6,hi:14,p:72,syn:['drop ceiling','suspended ceiling','t-bar ceiling','acoustic ceiling','ceiling tiles','ceiling grid','office ceiling']},
{t:'General Contractor',c:'Materials',n:'Drop ceiling grid and tiles (per sqft)',d:'T-bar grid, wire hangers, and acoustic ceiling tiles',lo:3,hi:7,p:68,syn:['ceiling tiles','t-bar grid','acoustic tiles','ceiling materials']},
{t:'General Contractor',c:'Labour',n:'Commercial demolition and strip-out',d:'Demo existing walls, flooring, ceiling, and fixtures for reno',lo:4,hi:12,p:72,syn:['demolition','demo','strip out','commercial demo','gut','commercial demolition','reno demo']},
{t:'General Contractor',c:'Labour',n:'ADA / barrier-free washroom renovation',d:'Renovate washroom to ADA / barrier-free code — grab bars, clearances, fixtures',lo:4500,hi:12000,p:55,syn:['ada washroom','ada bathroom','barrier free','accessible washroom','handicap washroom','wheelchair washroom','accessible bathroom']},
{t:'General Contractor',c:'Labour',n:'Commercial concrete pad pour',d:'Form and pour concrete pad for equipment, HVAC, or dumpster',lo:12,hi:28,p:62,syn:['concrete pad','equipment pad','concrete pour','slab pour','concrete slab','dumpster pad','hvac pad']},
{t:'General Contractor',c:'Labour',n:'Commercial interior painting',d:'Prep and paint commercial interior walls and ceilings',lo:2,hi:5,p:78,syn:['commercial painting','office painting','warehouse painting','interior painting commercial','commercial paint']},
{t:'General Contractor',c:'Labour',n:'Install commercial flooring',d:'Install LVP, carpet tile, or sheet vinyl in commercial space',lo:6,hi:14,p:72,syn:['commercial flooring','carpet tile','lvp commercial','sheet vinyl','office flooring','commercial floor']},
{t:'General Contractor',c:'Materials',n:'Commercial carpet tile (per sqft)',d:'Commercial-grade carpet tile with adhesive',lo:3,hi:8,p:65,syn:['carpet tile','commercial carpet','office carpet']},
{t:'General Contractor',c:'Labour',n:'Install commercial door and hardware',d:'Install commercial-grade door with closer, lockset, and frame',lo:450,hi:1200,p:62,syn:['commercial door','office door','fire door','door and hardware','door install commercial']},
{t:'General Contractor',c:'Labour',n:'Storefront glass and door install',d:'Install aluminum storefront framing and glass door entry',lo:2500,hi:6500,p:48,syn:['storefront','glass door','storefront glass','aluminum storefront','commercial entry','glass entry']},
{t:'General Contractor',c:'Labour',n:'Commercial washroom renovation',d:'Full washroom renovation — fixtures, tile, partitions, accessories',lo:5000,hi:15000,p:58,syn:['commercial washroom','office washroom','commercial bathroom','washroom renovation commercial','washroom reno']},
{t:'General Contractor',c:'Labour',n:'Install toilet partitions',d:'Install floor-mount or ceiling-hung toilet partitions in commercial washroom',lo:350,hi:800,p:55,syn:['toilet partition','bathroom partition','washroom stall','stall partition','divider']},
{t:'General Contractor',c:'Materials',n:'Toilet partition set',d:'Phenolic or HDPE toilet partition panel, pilaster, door, and hardware',lo:400,hi:1200,p:48,syn:['partition set','stall materials','washroom partition']},
{t:'General Contractor',c:'Labour',n:'Unit turnover — commercial',d:'Cleanup, patch, paint, and repair for commercial unit turnover',lo:1500,hi:4500,p:68,syn:['unit turnover','tenant turnover','strip mall turnover','commercial turnover','turnover','make ready']},
{t:'General Contractor',c:'Services',n:'Commercial building permit',d:'Pull building permit for commercial renovation or construction',lo:250,hi:800,p:72,syn:['commercial permit','building permit','permit commercial','construction permit']},
];

// ═══════════════════════════════════════════════════════════════
// CATALOG UTILITIES — search, browse, stats
// ═══════════════════════════════════════════════════════════════
export default C

const TRADE_ALIASES = {
  'Plumber': 'Plumber', 'Plumbing': 'Plumber',
  'Electrician': 'Electrician', 'Electrical': 'Electrician',
  'HVAC': 'HVAC',
  'General Contractor': 'General Contractor', 'GC': 'General Contractor',
  'Roofer': 'Roofing', 'Roofing': 'Roofing',
  'Painter': 'Painter', 'Painting': 'Painter',
  'Landscaper': 'Landscaping', 'Landscaping': 'Landscaping',
  'Carpenter': 'Carpenter', 'Carpentry': 'Carpenter',
  'Handyman': 'General Contractor', 'Other': 'Other',
}

function normalizeTrade(t) { return TRADE_ALIASES[t] || t }

export function searchCatalog(query, trade, limit = 20, province = null) {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/)
  const normalizedTrade = normalizeTrade(trade)

  function fuzzyMatch(word, haystack) {
    if (haystack.includes(word)) return true
    if (word.length <= 3) return false
    for (let i = 0; i < word.length; i++) {
      const shorter = word.slice(0, i) + word.slice(i + 1)
      if (shorter.length >= 3 && haystack.includes(shorter)) return true
    }
    for (let i = 0; i < word.length - 1; i++) {
      const swapped = word.slice(0, i) + word[i+1] + word[i] + word.slice(i + 2)
      if (haystack.includes(swapped)) return true
    }
    const hayWords = haystack.split(/[\s,/]+/)
    for (const hw of hayWords) {
      if (hw.length < 3 || Math.abs(hw.length - word.length) > 2) continue
      if (hw.length === word.length + 1) {
        for (let i = 0; i < hw.length; i++) {
          if (hw.slice(0,i) + hw.slice(i+1) === word) return true
        }
      }
      let diffs = 0
      const minLen = Math.min(hw.length, word.length)
      for (let i = 0; i < minLen; i++) { if (hw[i] !== word[i]) diffs++; }
      diffs += Math.abs(hw.length - word.length)
      if (diffs <= 2 && minLen >= 4) return true
    }
    return false
  }

  return C
    .map(item => {
      const hay = [item.n, item.d, ...(item.syn||[])].join(' ').toLowerCase()
      const allMatch = words.every(w => {
        if (w.length <= 3) return hay.includes(w)
        if (hay.includes(w) || hay.includes(w.slice(0, -1))) return true
        return fuzzyMatch(w, hay)
      })
      if (!allMatch) return null
      let score = 0
      if (normalizedTrade && normalizedTrade !== 'Other') {
        if (item.t === normalizedTrade) score += 100
        else score -= 20
      }
      if (item.n.toLowerCase().includes(q)) score += 50
      if (item.c === 'Materials') score += 5
      score += (item.p || 50)
      const synMatch = (item.syn || []).some(s => s.toLowerCase().includes(q))
      if (synMatch) score += 30
      return { ...item, _score: score }
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
}

export function browseCatalog(trade, limit = 50) {
  const normalizedTrade = normalizeTrade(trade)
  if (!normalizedTrade || normalizedTrade === 'Other') return C.slice(0, limit)
  return C
    .filter(item => item.t === normalizedTrade)
    .sort((a, b) => (b.p || 50) - (a.p || 50))
    .slice(0, limit)
}

export function getCatalogItem(id) {
  return C.find(item => item.id === id) || null
}

export function getCatalogByTrade(trade) {
  const normalizedTrade = normalizeTrade(trade)
  return C.filter(item => item.t === normalizedTrade)
}

export const CATALOG_STATS = {
  total: C.length,
  byTrade: C.reduce((acc, item) => { acc[item.t] = (acc[item.t] || 0) + 1; return acc }, {}),
  byCategory: C.reduce((acc, item) => { acc[item.c] = (acc[item.c] || 0) + 1; return acc }, {}),
}
