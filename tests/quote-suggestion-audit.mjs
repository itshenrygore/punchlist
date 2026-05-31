// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Offline Quote Suggestion Audit
// Exercises getSmartSuggestions() across realistic jobs in every
// trade and reports coverage + sanity so we can validate the
// offline engine against real contractor knowledge.
//
//   node tests/quote-suggestion-audit.mjs           # full report
//   node tests/quote-suggestion-audit.mjs --fails    # only problems
// ═══════════════════════════════════════════════════════════════
import { getSmartSuggestions } from '../shared/smartCatalog.js';

const FAILS_ONLY = process.argv.includes('--fails');

// Each case: { trade, desc, expect?: [substrings that SHOULD appear in
// some suggested item name], avoid?: [substrings that should NOT appear] }
// `expect` is a soft signal — a contractor-knowledge sanity anchor.
const CASES = [
  // ── PLUMBING ──
  { trade: 'Plumber', desc: 'Replace 50 gallon gas water heater, old one is leaking', expect: ['water heater'], avoid: ['urinal','panel'] },
  { trade: 'Plumber', desc: 'Replace kitchen faucet, customer has a new Moen ready', expect: ['faucet'] },
  { trade: 'Plumber', desc: 'Running toilet, needs diagnosis and repair', expect: ['toilet'] },
  { trade: 'Plumber', desc: 'Whole home poly b repipe to PEX, 1990 house, 2 bathrooms', expect: ['pex','repipe','pipe'], avoid: ['urinal','faucet aerator'] },
  { trade: 'Plumber', desc: 'Clogged kitchen sink drain, water backing up', expect: ['drain','snake','auger'] },
  { trade: 'Plumber', desc: 'Install sump pump in basement with battery backup', expect: ['sump'] },
  { trade: 'Plumber', desc: 'Tankless water heater install, Navien, convert from tank', expect: ['tankless','water heater'] },
  { trade: 'Plumber', desc: 'Frozen burst pipe in basement, copper, needs repair', expect: ['pipe'] },
  { trade: 'Plumber', desc: 'Add gas line for new BBQ on the deck', expect: ['gas'] },
  { trade: 'Plumber', desc: 'Relocate kitchen sink plumbing to island, rough-in new drain and vent', expect: ['rough','drain','vent'] },
  { trade: 'Plumber', desc: 'Garburator not working, replace garbage disposal', expect: ['garburator','disposal'] },
  { trade: 'Plumber', desc: 'Sewer line backing up, need camera inspection and auger', expect: ['sewer','camera','auger'] },
  { trade: 'Plumber', desc: 'Install new shower valve and trim kit, leaking behind wall', expect: ['shower','valve'] },

  // ── ELECTRICAL ──
  { trade: 'Electrician', desc: 'Upgrade electrical panel from 100A to 200A service', expect: ['panel','200'], avoid: ['water heater'] },
  { trade: 'Electrician', desc: 'Install EV charger in garage, NEMA 14-50, 50A circuit', expect: ['ev','charger','circuit'] },
  { trade: 'Electrician', desc: 'Add 6 pot lights in living room ceiling on a dimmer', expect: ['pot light','recessed','dimmer'] },
  { trade: 'Electrician', desc: 'Dead outlet in bedroom, not working, troubleshoot', expect: ['outlet'] },
  { trade: 'Electrician', desc: 'Install ceiling fan in master bedroom, no existing box', expect: ['fan','box'] },
  { trade: 'Electrician', desc: 'Whole home rewire, knob and tube, 1940s house', expect: ['rewire','wire'] },
  { trade: 'Electrician', desc: 'Hot tub wiring, 240v GFCI disconnect, 60A', expect: ['hot tub','disconnect','gfci'] },
  { trade: 'Electrician', desc: 'Install hardwired smoke detectors, interconnected, 5 units', expect: ['smoke'] },
  { trade: 'Electrician', desc: 'Add subpanel in detached garage, trench and conduit', expect: ['subpanel','conduit'] },
  { trade: 'Electrician', desc: 'Generator transfer switch install with interlock', expect: ['transfer switch','generator','interlock'] },
  { trade: 'Electrician', desc: 'Breaker keeps tripping in kitchen, diagnose', expect: ['breaker'] },

  // ── HVAC ──
  { trade: 'HVAC', desc: 'Furnace not igniting, no heat, need diagnostic and repair', expect: ['furnace','ignitor','igniter','flame sensor'] },
  { trade: 'HVAC', desc: 'Replace central AC condenser, 3 ton, 18 years old', expect: ['condenser','ac','air condition'] },
  { trade: 'HVAC', desc: 'Install ductless mini split, single zone wall mount', expect: ['mini split','line set'] },
  { trade: 'HVAC', desc: 'Install Ecobee smart thermostat, has C wire', expect: ['thermostat'] },
  { trade: 'HVAC', desc: 'AC not cooling, blowing warm air, low refrigerant suspected', expect: ['refrigerant','capacitor','ac'] },
  { trade: 'HVAC', desc: 'Replace furnace and AC full system, 96 AFUE, 16 SEER', expect: ['furnace','condenser','ac'] },
  { trade: 'HVAC', desc: 'Boiler not working, no heat, hydronic system', expect: ['boiler'] },
  { trade: 'HVAC', desc: 'Install whole home humidifier on furnace', expect: ['humidifier'] },
  { trade: 'HVAC', desc: 'Install garage unit heater with gas line', expect: ['garage heater','heater'] },
  { trade: 'HVAC', desc: 'Annual furnace tune up and maintenance', expect: ['furnace','tune','service','maintenance'] },

  // ── CARPENTER ──
  { trade: 'Carpenter', desc: 'Install baseboard trim throughout main floor, 120 linear feet', expect: ['baseboard'] },
  { trade: 'Carpenter', desc: 'Replace prehung interior bedroom door with casing', expect: ['door'] },
  { trade: 'Carpenter', desc: 'Build a 12x16 cedar deck with railing and stairs', expect: ['deck','railing'] },
  { trade: 'Carpenter', desc: 'Build 6 foot privacy fence, 60 linear feet cedar', expect: ['fence'] },
  { trade: 'Carpenter', desc: 'Install crown moulding in living and dining room', expect: ['crown'] },
  { trade: 'Carpenter', desc: 'Squeaky stairs and loose handrail, repair', expect: ['stair','rail'] },

  // ── ROOFING ──
  { trade: 'Roofing', desc: 'Replace missing shingles after wind storm', expect: ['shingle'] },
  { trade: 'Roofing', desc: 'Roof leak around plumbing vent stack, replace boot', expect: ['vent boot','boot','flashing'] },
  { trade: 'Roofing', desc: 'Install new eavestrough and downspouts, full house', expect: ['gutter','eavestrough','downspout'] },
  { trade: 'Roofing', desc: 'Chimney flashing leak, reflash and seal', expect: ['chimney','flashing'] },
  { trade: 'Roofing', desc: 'Replace rotten soffit and fascia on north side', expect: ['soffit','fascia'] },

  // ── PAINTER ──
  { trade: 'Painter', desc: 'Repaint two bedrooms, walls and ceiling, prep included', expect: ['paint','primer'] },
  { trade: 'Painter', desc: 'Kitchen cabinet refinishing, sand and spray', expect: ['cabinet'] },
  { trade: 'Painter', desc: 'Exterior house repaint, scrape prime two coats', expect: ['exterior','paint'] },
  { trade: 'Painter', desc: 'Stain and seal the back deck', expect: ['stain','deck'] },

  // ── LANDSCAPING ──
  { trade: 'Landscaping', desc: 'Install 200 sq ft paver patio with base', expect: ['patio','paver'] },
  { trade: 'Landscaping', desc: 'Replace front lawn with sod, 1000 sq ft', expect: ['sod','lawn'] },
  { trade: 'Landscaping', desc: 'Build 24 inch retaining wall, 30 feet, block', expect: ['retaining','wall'] },
  { trade: 'Landscaping', desc: 'Install irrigation sprinkler system, 4 zones', expect: ['irrigation','sprinkler'] },

  // ── GENERAL CONTRACTOR ──
  { trade: 'General Contractor', desc: 'Gut and rebuild bathroom, 5x8, new tile and fixtures', expect: ['bathroom'] },
  { trade: 'General Contractor', desc: 'Develop basement, framing electrical drywall', expect: ['basement','framing','drywall'] },
  { trade: 'General Contractor', desc: 'Office tenant improvement, partition walls and drop ceiling', expect: ['partition','drop ceiling','wall'] },

  // ── SECONDARY TRADES (no OBJECTS taxonomy — relies on keyword fallback) ──
  { trade: 'Drywall', desc: 'Patch and repair drywall hole in hallway, tape and mud', expect: ['drywall','patch','mud'] },
  { trade: 'Flooring', desc: 'Install luxury vinyl plank, 600 sq ft main floor', expect: ['vinyl','plank','floor'] },
  { trade: 'Flooring', desc: 'Tile kitchen backsplash, subway tile, 30 sq ft', expect: ['tile','backsplash'] },
  { trade: 'Garage Doors', desc: 'Replace broken garage door spring, 16 foot door', expect: ['garage','spring'] },
  { trade: 'Appliance Install', desc: 'Install dishwasher, hook up water and drain', expect: ['dishwasher'] },
  { trade: 'Fencing', desc: 'Install 100 feet of chain link fence with gate', expect: ['fence','chain'] },
  { trade: 'Siding', desc: 'Replace damaged vinyl siding on the gable end', expect: ['siding'] },
  { trade: 'Windows & Doors', desc: 'Replace 5 vinyl windows, double hung', expect: ['window'] },
  { trade: 'Concrete', desc: 'Pour 20x20 concrete driveway with rebar', expect: ['concrete','driveway'] },
  { trade: 'Restoration', desc: 'Water damage cleanup in basement, extract and dry', expect: ['water','dry','extract','restoration'] },
  { trade: 'Handyman', desc: 'Mount 65 inch TV on wall and conceal cords', expect: [] },

  // ── HARD / EDGE CASES (trade left as Other — must infer) ──
  { trade: 'Other', desc: 'Replace kitchen faucet and shutoff valves', expect: ['faucet'] },
  { trade: 'Other', desc: 'Install pot lights and a dimmer in the kitchen', expect: ['pot light','recessed'] },
  { trade: 'Other', desc: 'Furnace making a loud noise and short cycling', expect: ['furnace'] },

  // ── PLUMBING (depth) ──
  { trade: 'Plumber', desc: 'Low water pressure throughout the house, suspect PRV', expect: ['pressure'] },
  { trade: 'Plumber', desc: 'Install water softener for hard water', expect: ['softener','water treatment'] },
  { trade: 'Plumber', desc: 'Annual backflow preventer test and certification', expect: ['backflow'] },
  { trade: 'Plumber', desc: 'Replace frost-free hose bib on exterior wall', expect: ['hose bib','outdoor faucet'] },
  { trade: 'Plumber', desc: 'Install floor drain in basement laundry area', expect: ['floor drain','drain'] },
  { trade: 'Plumber', desc: 'Run a water line to the fridge for the ice maker', expect: ['fridge','ice maker','water line'] },
  { trade: 'Plumber', desc: 'Washing machine hookup, new washer box and valves', expect: ['laundry','washer','box'] },
  { trade: 'Plumber', desc: 'Install bidet seat on existing toilet', expect: ['bidet'] },
  { trade: 'Plumber', desc: 'Replace bathroom vanity sink and faucet', expect: ['sink','faucet','vanity'] },

  // ── ELECTRICAL (depth) ──
  { trade: 'Electrician', desc: 'Install GFCI outlets in kitchen and bathrooms', expect: ['gfci'] },
  { trade: 'Electrician', desc: 'Replace three-way light switch in hallway', expect: ['switch'] },
  { trade: 'Electrician', desc: 'Install video doorbell, needs transformer', expect: ['doorbell'] },
  { trade: 'Electrician', desc: 'Run cat6 ethernet drops to three rooms', expect: ['data','cat6','ethernet','cable'] },
  { trade: 'Electrician', desc: 'Install motion flood lights on the garage exterior', expect: ['outdoor light','flood','light'] },
  { trade: 'Electrician', desc: 'Add under cabinet LED lighting in kitchen', expect: ['cabinet'] },
  { trade: 'Electrician', desc: 'Wire a detached garage with outlets and lights', expect: ['garage','outlet','light'] },
  { trade: 'Electrician', desc: 'Install hardwired security cameras around the house', expect: ['camera','security'] },
  { trade: 'Electrician', desc: 'Add a dedicated 20A circuit for a new fridge', expect: ['circuit','dedicated'] },

  // ── HVAC (depth) ──
  { trade: 'HVAC', desc: 'Install HRV air exchanger, ducted to existing system', expect: ['hrv','air exchanger'] },
  { trade: 'HVAC', desc: 'Gas fireplace pilot light wont stay lit, service it', expect: ['fireplace'] },
  { trade: 'HVAC', desc: 'Uneven heating, one room always cold, balance airflow', expect: ['airflow','damper','duct','balanc'] },
  { trade: 'HVAC', desc: 'Modify ductwork and add a return air duct', expect: ['duct'] },
  { trade: 'HVAC', desc: 'AC compressor frozen, ice on the coil', expect: ['refrigerant','coil','ac'] },
  { trade: 'HVAC', desc: 'Replace the AC contactor, it burned out', expect: ['contactor'] },

  // ── CARPENTER (depth) ──
  { trade: 'Carpenter', desc: 'Install a new exterior steel entry door with deadbolt', expect: ['exterior door','door'] },
  { trade: 'Carpenter', desc: 'Build custom closet shelving and rods', expect: ['shelving','shelf'] },
  { trade: 'Carpenter', desc: 'Replace rotten deck boards and re-stain', expect: ['deck'] },

  // ── ROOFING (depth) ──
  { trade: 'Roofing', desc: 'Skylight leaking, reflash and reseal', expect: ['skylight'] },
  { trade: 'Roofing', desc: 'Install gutter guards on existing eavestrough', expect: ['gutter','guard'] },

  // ── PAINTER / LANDSCAPING / DRYWALL / FLOORING (depth) ──
  { trade: 'Painter', desc: 'Remove old wallpaper and prep walls for paint', expect: ['wallpaper'] },
  { trade: 'Painter', desc: 'Paint interior trim and doors throughout', expect: ['trim','paint'] },
  { trade: 'Landscaping', desc: 'Build raised garden beds with mulch', expect: ['garden bed','mulch','bed'] },
  { trade: 'Landscaping', desc: 'Prune and remove a large tree in the backyard', expect: ['tree'] },
  { trade: 'Drywall', desc: 'Remove popcorn ceiling and skim coat smooth', expect: ['popcorn','ceiling','skim'] },
  { trade: 'Drywall', desc: 'Hang and finish drywall in a new basement', expect: ['drywall','hang','basement'] },
  { trade: 'Flooring', desc: 'Refinish existing hardwood floors, 800 sq ft', expect: ['hardwood','refinish'] },
  { trade: 'Flooring', desc: 'Install laminate flooring in two bedrooms', expect: ['laminate','floor'] },

  // ── COMMERCIAL ──
  { trade: 'Plumber', desc: 'Install grease trap for restaurant kitchen', expect: ['grease trap','trap'] },
  { trade: 'Plumber', desc: 'Replace commercial urinal flush valve', expect: ['urinal','flush valve'] },
  { trade: 'Plumber', desc: 'Install emergency eye wash station in the shop', expect: ['eye wash'] },
  { trade: 'Electrician', desc: 'Wire three phase power for a new commercial compressor', expect: ['three phase','phase'] },
  { trade: 'Electrician', desc: 'Replace emergency exit signs and egress lighting', expect: ['exit sign','emergency'] },
  { trade: 'Electrician', desc: 'Install parking lot pole lights with photocells', expect: ['parking lot','pole'] },
  { trade: 'General Contractor', desc: 'Install suspended drop ceiling grid and tiles in office', expect: ['drop ceiling','ceiling'] },
  { trade: 'General Contractor', desc: 'Frame demising partition wall between two units', expect: ['partition','wall'] },
  { trade: 'General Contractor', desc: 'Pour an equipment concrete pad for rooftop unit', expect: ['concrete pad','pad'] },

  // ── SECONDARY-TRADE depth ──
  { trade: 'Garage Doors', desc: 'Garage door off track and a bent panel', expect: ['garage','track','panel'] },
  { trade: 'Garage Doors', desc: 'Install a new smart garage door opener', expect: ['opener','garage'] },
  { trade: 'Appliance Install', desc: 'Install over the range microwave and vent it outside', expect: ['microwave','range'] },
  { trade: 'Appliance Install', desc: 'Hook up gas range, new gas connection', expect: ['range','gas'] },
  { trade: 'Fencing', desc: 'Replace broken fence posts and a few boards', expect: ['fence','post','board'] },
  { trade: 'Fencing', desc: 'Stain and seal existing cedar fence', expect: ['fence','stain'] },
  { trade: 'Concrete', desc: 'Repair a cracked foundation wall', expect: ['foundation','crack'] },
  { trade: 'Concrete', desc: 'Mudjack a settled garage slab', expect: ['mudjack','level'] },
  { trade: 'Restoration', desc: 'Mold remediation in the bathroom, large area', expect: ['mold','remediation'] },
  { trade: 'Restoration', desc: 'Sewage backup cleanup in the basement', expect: ['sewage','cleanup'] },
  { trade: 'Handyman', desc: 'Install grab bars and a towel bar in the bathroom', expect: ['grab bar','towel'] },
  { trade: 'Handyman', desc: 'Assemble flat pack furniture and hang shelves', expect: ['assemble','shelv'] },
  { trade: 'Handyman', desc: 'Gutter cleaning and minor downspout repair', expect: ['gutter'] },
  { trade: 'Windows & Doors', desc: 'Install an egress window in the basement bedroom', expect: ['egress','window'] },
  { trade: 'Windows & Doors', desc: 'Replace a foggy sealed glass unit in a window', expect: ['glass','window'] },
  { trade: 'Siding', desc: 'Install fiber cement Hardie board siding on front', expect: ['fiber cement','siding','hardie'] },

  // ── US-region (pricing multiplier path) ──
  { trade: 'Plumber', desc: 'Replace 40 gallon electric water heater', expect: ['water heater'], province: 'TX' },
  { trade: 'Electrician', desc: 'Panel upgrade to 200 amp service', expect: ['panel','200'], province: 'CA' },
  { trade: 'HVAC', desc: 'Install central AC condenser, 4 ton', expect: ['condenser','ac'], province: 'FL' },

  // ── AMBIGUOUS / MULTI-OBJECT / LOW-SIGNAL ──
  { trade: 'Plumber', desc: 'Replace kitchen sink, faucet, and garburator all at once', expect: ['sink','faucet','garburator'] },
  { trade: 'HVAC', desc: 'Replace furnace and add a smart thermostat', expect: ['furnace','thermostat'] },
  { trade: 'Other', desc: 'Bathroom is leaking somewhere, not sure where', expect: [] },
  { trade: 'Other', desc: 'Install a new hot water tank and expansion tank', expect: ['water heater','expansion'] },
  { trade: 'Electrician', desc: 'Outlets in half the house stopped working', expect: ['outlet','power','breaker'] },

  // ═══════════════════════════════════════════════════════════════
  // EXPANSION SET — residential + commercial, broader trade coverage
  // ═══════════════════════════════════════════════════════════════

  // ── PLUMBING (residential + commercial + edge cases) ──
  { trade: 'Plumber', desc: 'Replace cartridge in single-handle shower valve, no hot water', expect: ['cartridge','shower'] },
  { trade: 'Plumber', desc: 'Toilet flange broken, toilet rocks on the floor', expect: ['flange','toilet'] },
  { trade: 'Plumber', desc: 'Replace wax ring and re-set the toilet', expect: ['wax ring','toilet'] },
  { trade: 'Plumber', desc: 'Sewage ejector pump replacement in basement bathroom', expect: ['ejector','pump'] },
  { trade: 'Plumber', desc: 'Pressure reducing valve replacement, water pressure too high', expect: ['pressure','prv','reduc'] },
  { trade: 'Plumber', desc: 'Install pot filler over kitchen stove', expect: ['pot filler','filler'] },
  { trade: 'Plumber', desc: 'Replace galvanized supply lines with PEX, partial repipe', expect: ['pex','pipe','supply'] },
  { trade: 'Plumber', desc: 'Camera inspection of main sewer line, suspected roots', expect: ['camera','sewer'] },
  { trade: 'Plumber', desc: 'Hydro jet cleaning of clogged main drain', expect: ['hydro','jet','drain'] },
  { trade: 'Plumber', desc: 'Install double laundry sink in basement', expect: ['laundry','sink'] },
  { trade: 'Plumber', desc: 'Replace shower drain assembly and reseal', expect: ['drain','shower'] },
  { trade: 'Plumber', desc: 'Thaw frozen pipe in garage wall', expect: ['frozen','pipe'] },
  { trade: 'Plumber', desc: 'Anode rod replacement on hot water tank', expect: ['anode','water heater'] },
  { trade: 'Plumber', desc: 'Install reverse osmosis under-sink water filter', expect: ['water filter','filter','treatment'] },
  { trade: 'Plumber', desc: 'Replace mixing valve at water heater for tempered water', expect: ['mixing','valve','water heater'] },
  { trade: 'Plumber', desc: 'Restaurant commercial dishwasher hookup with backflow', expect: ['dishwasher','backflow'] },
  { trade: 'Plumber', desc: 'Mop sink install in commercial janitor room', expect: ['sink','drain'] },
  { trade: 'Plumber', desc: 'Install hands-free sensor faucet for office bathroom', expect: ['faucet'] },
  { trade: 'Plumber', desc: 'Commercial water softener install for restaurant', expect: ['softener','treatment'] },

  // ── ELECTRICAL (residential + commercial + edge cases) ──
  { trade: 'Electrician', desc: 'Replace knob and tube wiring in attic to bedroom circuit', expect: ['rewire','wire','knob','tube'] },
  { trade: 'Electrician', desc: 'Install arc fault breakers in bedroom panel', expect: ['afci','breaker'] },
  { trade: 'Electrician', desc: 'Replace double-tapped breakers with tandem or new circuits', expect: ['breaker'] },
  { trade: 'Electrician', desc: 'Install 240V outlet for electric dryer', expect: ['outlet','240','dryer'] },
  { trade: 'Electrician', desc: 'Wire a 100A subpanel in detached workshop', expect: ['subpanel','panel'] },
  { trade: 'Electrician', desc: 'Replace aluminum wiring pigtails with copper', expect: ['wire','aluminum','copper'] },
  { trade: 'Electrician', desc: 'Install smart switches in kitchen and living room', expect: ['switch','smart','dimmer'] },
  { trade: 'Electrician', desc: 'Run conduit and pull wire for new pool pump', expect: ['conduit','wire','pump'] },
  { trade: 'Electrician', desc: 'Replace 60A panel with 200A service upgrade', expect: ['panel','200','upgrade'] },
  { trade: 'Electrician', desc: 'Install bathroom fan with timer switch and ducting', expect: ['bathroom fan','fan','exhaust'] },
  { trade: 'Electrician', desc: 'Install whip and disconnect for new rooftop HVAC unit', expect: ['disconnect','whip','wire'] },
  { trade: 'Electrician', desc: 'Wire low voltage landscape lighting transformer', expect: ['light','outdoor','low voltage','landscape'] },
  { trade: 'Electrician', desc: 'Install solar panel inverter interconnect to main panel', expect: ['panel','inverter','solar','interconnect'] },
  { trade: 'Electrician', desc: 'Replace old fluorescent fixtures with LED in office ceiling', expect: ['light','fixture','dimmer'] },
  { trade: 'Electrician', desc: 'Install commercial walk-in cooler dedicated circuit', expect: ['dedicated','circuit','cooler'] },
  { trade: 'Electrician', desc: 'Wire restaurant hood fan and makeup air interlock', expect: ['hood','fan','wire'] },
  { trade: 'Electrician', desc: 'Trench and conduit for service to detached garage', expect: ['conduit','trench','subpanel','service'] },
  { trade: 'Electrician', desc: 'Install Tesla wall connector in garage with load monitor', expect: ['ev','charger','tesla'] },

  // ── HVAC (residential + commercial + edge cases) ──
  { trade: 'HVAC', desc: 'Replace blower motor on furnace, not blowing air', expect: ['blower','motor','furnace'] },
  { trade: 'HVAC', desc: 'Furnace flame sensor cleaning and gas valve check', expect: ['flame sensor','furnace','gas valve'] },
  { trade: 'HVAC', desc: 'AC capacitor swap, hard start kit install', expect: ['capacitor'] },
  { trade: 'HVAC', desc: 'Replace evaporator coil on central AC', expect: ['coil','evaporator','ac'] },
  { trade: 'HVAC', desc: 'Add return air drop to a hot upstairs bedroom', expect: ['duct','return','airflow'] },
  { trade: 'HVAC', desc: 'Install dual-zone damper system on existing ducts', expect: ['zone','damper','duct'] },
  { trade: 'HVAC', desc: 'Annual maintenance — furnace and AC tune-up', expect: ['furnace','ac','tune','maintenance'] },
  { trade: 'HVAC', desc: 'Replace 3-zone hydronic boiler zone valve', expect: ['boiler','zone valve','valve'] },
  { trade: 'HVAC', desc: 'Convert oil furnace to gas furnace, full conversion', expect: ['furnace','gas'] },
  { trade: 'HVAC', desc: 'Mitsubishi multi-zone mini split, 3 heads', expect: ['mini split','line set'] },
  { trade: 'HVAC', desc: 'Install electric baseboard heater in basement', expect: ['heater','baseboard','electric'] },
  { trade: 'HVAC', desc: 'Replace cracked heat exchanger on furnace', expect: ['furnace','heat exchanger'] },
  { trade: 'HVAC', desc: 'Commercial rooftop unit RTU service call', expect: ['rooftop','rtu','service','diagnostic'] },
  { trade: 'HVAC', desc: 'Install economizer on commercial RTU', expect: ['economizer','rooftop','rtu'] },
  { trade: 'HVAC', desc: 'Refrigerant leak repair on commercial walk-in cooler', expect: ['refrigerant','leak','cooler'] },
  { trade: 'HVAC', desc: 'Commercial kitchen exhaust hood balancing and makeup air', expect: ['hood','exhaust','airflow','makeup'] },
  { trade: 'HVAC', desc: 'Install VRF system in tenant office space, 4 indoor units', expect: ['indoor unit','mini split','head unit','air handler'] },

  // ── ROOFING (residential + commercial + edge cases) ──
  { trade: 'Roofing', desc: 'Full asphalt shingle roof replacement, 25 squares', expect: ['shingle','asphalt'] },
  { trade: 'Roofing', desc: 'Install ice and water shield at eaves and valleys', expect: ['ice','shield','underlayment'] },
  { trade: 'Roofing', desc: 'Replace metal flashing on chimney and chimney crown', expect: ['chimney','flashing'] },
  { trade: 'Roofing', desc: 'Replace ridge vent on entire roof', expect: ['ridge vent','vent'] },
  { trade: 'Roofing', desc: 'Repair leaking flat TPO roof on commercial building', expect: ['flat','tpo','leak','roof','membrane'] },
  { trade: 'Roofing', desc: 'Install drip edge metal along eaves', expect: ['drip edge','edge'] },
  { trade: 'Roofing', desc: 'Replace torch-down membrane on garage roof', expect: ['torch','membrane','flat','roof'] },
  { trade: 'Roofing', desc: 'Cedar shake roof partial replacement', expect: ['shingle','shake','roof'] },
  { trade: 'Roofing', desc: 'Install snow guards on metal roof', expect: ['snow','roof','metal'] },
  { trade: 'Roofing', desc: 'EPDM rubber roof patch on commercial flat roof', expect: ['epdm','rubber','flat','roof','membrane'] },
  { trade: 'Roofing', desc: 'Install gable end vent and bathroom roof vent cap', expect: ['vent','gable','cap'] },

  // ── FLOORING (residential + commercial + edge cases) ──
  { trade: 'Flooring', desc: 'Sand and refinish oak hardwood, 1200 sq ft, water-based finish', expect: ['hardwood','refinish'] },
  { trade: 'Flooring', desc: 'Install engineered hardwood in living room and hallway', expect: ['hardwood','floor'] },
  { trade: 'Flooring', desc: 'Tile heated bathroom floor over radiant mat', expect: ['tile','floor','heat'] },
  { trade: 'Flooring', desc: 'Install commercial-grade vinyl tile in retail showroom', expect: ['vinyl','tile','floor'] },
  { trade: 'Flooring', desc: 'Carpet tile install in office, 2000 sq ft', expect: ['carpet','floor','tile'] },
  { trade: 'Flooring', desc: 'Stair tread and riser install with oak nosing', expect: ['stair','tread','riser'] },
  { trade: 'Flooring', desc: 'Repair water-damaged hardwood section in kitchen', expect: ['hardwood','floor','repair','damage'] },
  { trade: 'Flooring', desc: 'Self-leveling concrete underlayment over uneven subfloor', expect: ['floor','prep','level','underlayment'] },
  { trade: 'Flooring', desc: 'Install epoxy floor coating in garage, 600 sq ft', expect: ['floor','epoxy','garage','coat'] },
  { trade: 'Flooring', desc: 'Install schluter waterproofing membrane in shower', expect: ['shower','tile','waterproof','membrane'] },

  // ── PAINTER (residential + commercial + edge cases) ──
  { trade: 'Painter', desc: 'Paint open-concept main floor, walls and ceiling, 2 coats', expect: ['paint','room','wall','ceiling'] },
  { trade: 'Painter', desc: 'Spray paint MDF closet built-ins', expect: ['paint','spray','cabinet'] },
  { trade: 'Painter', desc: 'Repaint commercial office, 4000 sq ft, low-VOC paint', expect: ['paint','room','interior','office'] },
  { trade: 'Painter', desc: 'Paint metal handrails and stair stringers', expect: ['paint','trim','stair'] },
  { trade: 'Painter', desc: 'Apply elastomeric paint on stucco exterior', expect: ['paint','exterior','stucco'] },
  { trade: 'Painter', desc: 'Repaint storefront awning and trim', expect: ['paint','trim','exterior'] },
  { trade: 'Painter', desc: 'Stain new cedar deck and pressure wash first', expect: ['stain','deck','wash'] },
  { trade: 'Painter', desc: 'Paint over water-stained drywall ceiling with stain blocker', expect: ['paint','primer','ceiling','stain'] },
  { trade: 'Painter', desc: 'Repaint kitchen cabinets in semi-gloss with bonding primer', expect: ['cabinet','paint','primer'] },
  { trade: 'Painter', desc: 'Faux finish accent wall in entryway', expect: ['paint','wall','room'] },

  // ── GENERAL CONTRACTOR (residential + commercial + edge cases) ──
  { trade: 'General Contractor', desc: 'Kitchen renovation, gut and rebuild, 200 sq ft, mid-range finishes', expect: ['kitchen','renovation','remodel','reno'] },
  { trade: 'General Contractor', desc: 'Basement development with bedroom, bathroom, and rec room', expect: ['basement','framing','drywall'] },
  { trade: 'General Contractor', desc: 'Build a 200 sq ft mudroom addition with foundation', expect: ['framing','addition','foundation'] },
  { trade: 'General Contractor', desc: 'Demolish interior load-bearing wall and install beam', expect: ['demo','beam','framing'] },
  { trade: 'General Contractor', desc: 'Garage conversion to rental suite, includes plumbing rough-in', expect: ['framing','drywall','garage'] },
  { trade: 'General Contractor', desc: 'Tenant improvement: convert warehouse to office, 1200 sq ft', expect: ['tenant','partition','wall','ceiling'] },
  { trade: 'General Contractor', desc: 'Install commercial accessible washroom with grab bars and partitions', expect: ['washroom','partition','renovation','grab bar','accessor'] },
  { trade: 'General Contractor', desc: 'Restaurant build-out, dining room and bar area', expect: ['tenant','partition','framing','renovation'] },
  { trade: 'General Contractor', desc: 'Storefront window and door replacement on retail unit', expect: ['storefront','glass','door'] },
  { trade: 'General Contractor', desc: 'Build a 300 sq ft second-storey addition', expect: ['framing','addition'] },

  // ── DRYWALL ──
  { trade: 'Drywall', desc: 'Drywall a whole basement and tape and mud, 700 sq ft', expect: ['drywall','hang','tape','mud','basement'] },
  { trade: 'Drywall', desc: 'Patch large 24 inch hole in hallway drywall', expect: ['drywall','patch','hole'] },
  { trade: 'Drywall', desc: 'Skim coat textured walls smooth in two bedrooms', expect: ['skim coat','wall','drywall'] },
  { trade: 'Drywall', desc: 'Install corner bead on new framed walls', expect: ['corner bead','drywall'] },
  { trade: 'Drywall', desc: 'Knockdown texture finish on living room ceiling', expect: ['texture','ceiling'] },

  // ── FENCING ──
  { trade: 'Fencing', desc: 'Install 80 feet of 6 foot pressure-treated wood privacy fence', expect: ['fence','wood','privacy'] },
  { trade: 'Fencing', desc: 'Replace 4 leaning fence posts and re-set in concrete', expect: ['fence','post'] },
  { trade: 'Fencing', desc: 'Install 100 feet of black aluminum ornamental fence', expect: ['fence','iron','ornamental'] },
  { trade: 'Fencing', desc: 'Install 60 feet of vinyl PVC fence with two gates', expect: ['fence','vinyl','pvc','gate'] },

  // ── CONCRETE ──
  { trade: 'Concrete', desc: 'Pour 40 foot concrete sidewalk with broom finish', expect: ['sidewalk','concrete'] },
  { trade: 'Concrete', desc: 'Stamped concrete patio, 250 sq ft', expect: ['stamped','concrete','patio'] },
  { trade: 'Concrete', desc: 'Seal driveway and crack-fill', expect: ['concrete','seal','crack'] },
  { trade: 'Concrete', desc: 'Pour footings for new deck, 6 piers', expect: ['concrete','pour'] },
  { trade: 'Concrete', desc: 'Commercial dumpster pad with rebar, 12x12', expect: ['concrete','pad','slab'] },

  // ── WINDOWS & DOORS ──
  { trade: 'Windows & Doors', desc: 'Install storm door over front entry door', expect: ['storm door','door'] },
  { trade: 'Windows & Doors', desc: 'Replace patio sliding door with French doors', expect: ['patio door','door'] },
  { trade: 'Windows & Doors', desc: 'Install three new casement windows in living room', expect: ['casement','window','replace'] },
  { trade: 'Windows & Doors', desc: 'Weatherstrip and adjust all exterior doors', expect: ['weatherstrip','door'] },

  // ── SIDING ──
  { trade: 'Siding', desc: 'Full house re-side with vinyl siding and house wrap', expect: ['siding','vinyl','wrap'] },
  { trade: 'Siding', desc: 'Repair storm-damaged section of cedar siding', expect: ['siding','repair'] },
  { trade: 'Siding', desc: 'Replace 30 feet of rotten soffit and fascia', expect: ['soffit','fascia'] },

  // ── GARAGE DOORS ──
  { trade: 'Garage Doors', desc: 'Replace bent garage door panel and rollers', expect: ['garage','panel','roller'] },
  { trade: 'Garage Doors', desc: 'Install new insulated double garage door with opener', expect: ['garage door','opener','double'] },
  { trade: 'Garage Doors', desc: 'Replace weather seal at bottom of garage door', expect: ['garage','weather','seal'] },

  // ── APPLIANCE INSTALL ──
  { trade: 'Appliance Install', desc: 'Install built-in wall oven and cooktop', expect: ['oven','range'] },
  { trade: 'Appliance Install', desc: 'Install gas dryer with new gas connection and vent', expect: ['dryer','gas','vent'] },
  { trade: 'Appliance Install', desc: 'Install washer-dryer stacking kit', expect: ['washer','dryer'] },
  { trade: 'Appliance Install', desc: 'Install French door refrigerator with ice maker line', expect: ['fridge','refrigerator'] },

  // ── RESTORATION ──
  { trade: 'Restoration', desc: 'Burst pipe water damage in finished basement, three rooms affected', expect: ['water','extract','dry','damage'] },
  { trade: 'Restoration', desc: 'Mold remediation in attic from roof leak, 200 sq ft', expect: ['mold','remediation'] },
  { trade: 'Restoration', desc: 'Smoke damage cleanup after small kitchen fire', expect: ['smoke','cleaning'] },
  { trade: 'Restoration', desc: 'Asbestos abatement on old basement pipe insulation', expect: ['asbestos'] },

  // ── HANDYMAN (small jobs) ──
  { trade: 'Handyman', desc: 'Mount three TVs in different rooms and conceal cords', expect: ['tv','mount'] },
  { trade: 'Handyman', desc: 'Install closet organizer kit in master bedroom', expect: ['closet','organizer','shelv'] },
  { trade: 'Handyman', desc: 'Replace 5 interior door knobs and deadbolt on front door', expect: ['door','hardware','deadbolt'] },
  { trade: 'Handyman', desc: 'Fix three running toilets and replace flapper assemblies', expect: ['toilet','flapper','fill'] },
  { trade: 'Handyman', desc: 'Caulk around kitchen and bathroom counters and tubs', expect: ['caulk'] },
  { trade: 'Handyman', desc: 'Re-hang sagging interior door', expect: ['door','hang'] },
  { trade: 'Handyman', desc: 'Pressure wash driveway and patio', expect: ['pressure','wash'] },

  // ── MULTI-TRADE / AMBIGUOUS / NATURAL-LANGUAGE ──
  { trade: 'Other', desc: 'Customer wants a new bathroom in their basement, includes plumbing rough-in and tile', expect: ['bathroom','plumbing','rough','tile'] },
  { trade: 'Other', desc: 'Outdoor kitchen with gas line, electrical, and concrete pad', expect: ['gas','outlet','concrete','pad'] },
  { trade: 'Other', desc: 'EV charger install with panel upgrade to 200A', expect: ['panel','ev','charger','200'] },
  { trade: 'Other', desc: 'New basement laundry — drain rough-in, supply, and electrical for washer dryer', expect: ['laundry','drain','rough','outlet','circuit','plumbing','diagnostic'] },

  // ── US-region pricing path ──
  { trade: 'HVAC', desc: 'Install heat pump system in Phoenix, 4 ton package unit', expect: ['heat pump','condenser','indoor'], province: 'AZ' },
  { trade: 'Plumber', desc: 'Tankless water heater install in California single-family home', expect: ['tankless','water heater'], province: 'CA' },
  { trade: 'Electrician', desc: 'Pool pump electrical hookup in Florida backyard', expect: ['pump','wire','outlet','ground','permit'], province: 'FL' },
  { trade: 'Roofing', desc: 'Hurricane-rated roof replacement on coastal home', expect: ['shingle','roof','ice','underlayment'], province: 'FL' },

  // ── ADVERSARIAL — vague or trick descriptions ──
  { trade: 'Other', desc: 'I need help', expect: [] },
  { trade: 'Other', desc: 'My wife wants something fixed in the house', expect: [] },
  { trade: 'Plumber', desc: 'It leaks somewhere', expect: [] },

  // ── DEFINITIONAL CROSS-TRADE — sanity checks for trade gating ──
  // A plumber selected, but the description is electrical — engine should
  // not surface electrical items as "core" when the user explicitly chose
  // plumbing (safer to under-suggest than to hand a plumber an outlet line).
  { trade: 'Plumber', desc: 'Add a few new outlets in the kitchen', avoid: ['Install panel'] },
  { trade: 'Electrician', desc: 'Replace the water heater', avoid: ['Install kitchen faucet'] },
];

function fmt$(n) { return '$' + Math.round(n).toLocaleString(); }
function lc(s) { return String(s || '').toLowerCase(); }

let totalCore = 0, zeroCore = 0, zeroAll = 0, expectMiss = 0, avoidHit = 0;
const problems = [];

for (const c of CASES) {
  const r = getSmartSuggestions({ description: c.desc, trade: c.trade, province: c.province || 'AB' });
  const ctx = r.context;
  const allItems = [...r.core, ...r.related, ...r.optional];
  const allNames = allItems.map(i => lc(i.name));
  const coreTotal = r.core.reduce((s, i) => s + (i.mid || 0), 0);
  const grandTotal = allItems.reduce((s, i) => s + (i.mid || 0), 0);

  // Cases with an explicit empty expect[] are intentionally vague ("I need
  // help") — returning zero is the correct answer, so they don't count as
  // problems. Without this, the harness would penalise the engine for
  // doing the right thing on garbage input.
  const expectsNothing = Array.isArray(c.expect) && c.expect.length === 0;
  totalCore += r.core.length;
  if (r.core.length === 0 && !expectsNothing) zeroCore++;
  if (allItems.length === 0 && !expectsNothing) zeroAll++;

  // Expect check: at least one expected substring appears somewhere
  let expectOk = true;
  if (c.expect && c.expect.length) {
    expectOk = c.expect.some(e => allNames.some(n => n.includes(lc(e))));
    if (!expectOk) expectMiss++;
  }
  // Avoid check
  let avoidBad = [];
  if (c.avoid && c.avoid.length) {
    avoidBad = c.avoid.filter(a => allNames.some(n => n.includes(lc(a))));
    if (avoidBad.length) avoidHit++;
  }

  const isProblem = (r.core.length === 0 && !expectsNothing)
    || (allItems.length === 0 && !expectsNothing)
    || !expectOk
    || avoidBad.length > 0;
  if (isProblem) {
    problems.push({ c, r, ctx, expectOk, avoidBad, coreTotal, grandTotal });
  }

  if (FAILS_ONLY && !isProblem) continue;

  const flag = isProblem ? '  ⚠️ ' : '  ✓ ';
  console.log(`\n${flag}[${c.trade}] "${c.desc}"`);
  console.log(`     ctx → trade:${ctx.trade} type:${ctx.jobType || '—'} conf:${ctx.confidence} objects:[${ctx.objects.join(', ') || '—'}]`);
  console.log(`     core(${r.core.length}) related(${r.related.length}) optional(${r.optional.length})  total≈${fmt$(grandTotal)}`);
  for (const i of r.core)     console.log(`       ● ${i.name}  ${fmt$(i.lo)}–${fmt$(i.hi)}   « ${i.reason}`);
  for (const i of r.related)  console.log(`       ○ ${i.name}  ${fmt$(i.lo)}–${fmt$(i.hi)}   « ${i.reason}`);
  for (const i of r.optional) console.log(`       · ${i.name}  ${fmt$(i.lo)}–${fmt$(i.hi)}`);
  if (!expectOk)      console.log(`     ⚠️ EXPECTED one of [${c.expect.join(', ')}] — none found`);
  if (avoidBad.length) console.log(`     ⚠️ AVOID violated: matched [${avoidBad.join(', ')}]`);
}

console.log('\n' + '═'.repeat(64));
console.log(`SUMMARY — ${CASES.length} jobs`);
console.log(`  avg core items/job : ${(totalCore / CASES.length).toFixed(2)}`);
console.log(`  jobs with 0 core   : ${zeroCore}`);
console.log(`  jobs with 0 items  : ${zeroAll}`);
console.log(`  expected-miss      : ${expectMiss}`);
console.log(`  avoid-violations   : ${avoidHit}`);
console.log(`  TOTAL PROBLEM JOBS : ${problems.length} / ${CASES.length}`);
console.log('═'.repeat(64));
