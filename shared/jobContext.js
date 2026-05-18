// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — JOB CONTEXT ENGINE v1
// Extracts structured job context from free-text descriptions.
// Powers smart catalog filtering when AI is unavailable/weak.
// ═══════════════════════════════════════════════════════════════

// ── JOB TYPES ──
// What the contractor is doing (verb intent)
const JOB_TYPE_PATTERNS = {
  install:   /\b(install|add|mount|hang|set up|setup|hook ?up|connect|wire|run|put in|new)\b/i,
  replace:   /\b(replace|swap|change out|upgrade|switch out|new .{0,20}(for|replacing|instead))\b/i,
  repair:    /\b(repair|fix|patch|seal|stop leak|troubleshoot|diagnose|not working|not heating|not cooling|no heat|no cool|broken|leak|clog|clogged|stuck|crack|damage|faulty|backed up|running|dripping|tripping|flickering|squeaky|noisy|loud)\b/i,
  remove:    /\b(remove|demo|demolish|tear out|rip out|gut|strip|take out|disconnect|cap off)\b/i,
  maintain:  /\b(maintain|service|tune.?up|clean|inspect|test|check|annual|seasonal|flush|blowout)\b/i,
  relocate:  /\b(relocate|move|reroute|rerun|extend|re-?route|re-?run|rough.?in)\b/i,
};

// ── OBJECT TAXONOMY ──
// Physical things the work is about. Each object maps to related objects
// that should also be shown (e.g., faucet → supply lines, p-trap)
const OBJECTS = {
  // ── PLUMBING OBJECTS (primary target trade) ──
  faucet:           { syn: ['faucet','kitchen faucet','bathroom faucet','tap replace','leaky faucet','dripping faucet','faucet repair'], related: ['supply line','p-trap','drain','shutoff valve','caulk','cartridge'], trade: 'Plumber' },
  'kitchen faucet': { syn: ['kitchen faucet','kitchen tap','kitchen mixer','kitchen spout'], related: ['supply line','p-trap','drain','shutoff valve','garburator','sink','drain assembly','putty'], trade: 'Plumber' },
  'bathroom faucet':{ syn: ['bathroom faucet','vanity faucet','lav faucet','basin faucet','lavatory faucet','washroom faucet'], related: ['supply line','p-trap','drain','shutoff valve','drain assembly','vanity'], trade: 'Plumber' },
  sink:             { syn: ['sink','kitchen sink','bathroom sink','basin','undermount sink','drop-in sink'], related: ['faucet','p-trap','drain','supply line','caulk','garburator','drain assembly','shutoff valve'], trade: 'Plumber' },
  'kitchen sink':   { syn: ['kitchen sink','undermount sink','drop-in sink','farmhouse sink','kitchen basin'], related: ['kitchen faucet','p-trap','drain','supply line','garburator','caulk','shutoff valve','drain assembly','putty','dishwasher','relocate plumbing','rough-in','island vent','air admittance valve','extend supply','floor penetration','subfloor'], trade: 'Plumber' },
  'bathroom sink':  { syn: ['bathroom sink','vanity sink','vessel sink','pedestal sink','powder room sink'], related: ['bathroom faucet','p-trap','drain','supply line','shutoff valve','drain assembly','vanity','putty'], trade: 'Plumber' },
  'bathroom plumbing': { syn: ['bathroom plumbing','bathroom rough-in','second bathroom','new bathroom','add bathroom','basement bathroom'], related: ['toilet','shower','vanity','drain','vent','supply line','rough-in','p-trap','shutoff valve'], trade: 'Plumber' },
  toilet:           { syn: ['toilet','commode','water closet','running toilet','toilet leak','leaking toilet'], related: ['wax ring','flapper','fill valve','supply line','shutoff valve','flange','closet bolts'], trade: 'Plumber' },
  'water heater':   { syn: ['water heater','hot water tank','hwt','hot water heater','gas water heater','electric water heater'], related: ['expansion tank','gas line','venting','anode rod','thermocouple','shutoff valve','mixing valve','t&p valve'], trade: 'Plumber' },
  'tankless':       { syn: ['tankless','tankless water heater','on demand water heater','navien','rinnai','instant hot water'], related: ['gas line','venting','isolation valve','mixing valve','descaling','condensate'], trade: 'Plumber' },
  shower:           { syn: ['shower','shower valve','shower head','shower cartridge','shower door','shower leak','shower repair'], related: ['shower valve','trim kit','cartridge','shower head','caulk','drain','tile','diverter'], trade: 'Plumber' },
  tub:              { syn: ['bathtub','soaker tub','tub drain','tub faucet','tub spout','alcove tub'], related: ['drain','overflow','faucet','caulk','shower valve','tile','waste and overflow'], trade: 'Plumber' },
  'sump pump':      { syn: ['sump pump','sump pit','ejector pump','basement pump','sump install','sump replace'], related: ['check valve','discharge line','float switch','backup battery','alarm'], trade: 'Plumber' },
  drain:            { syn: ['drain cleaning','clogged drain','blocked drain','slow drain','snake drain','auger drain','drain clog'], related: ['p-trap','cleanout','auger','hydro jet','camera inspection'], trade: 'Plumber' },
  'gas line':       { syn: ['gas line','gas pipe','gas hookup','gas connection','bbq gas line','gas run','gas piping'], related: ['gas connector','shutoff valve','black iron','gas fitting','leak test','pressure test'], trade: 'Plumber' },
  garburator:       { syn: ['garburator','garbage disposal','insinkerator','disposal unit','garburator replace'], related: ['drain','p-trap','reset button','electrical connection'], trade: 'Plumber' },
  pipe:             { syn: ['pipe leak','leaky pipe','leaking pipe','burst pipe','frozen pipe','pipe repair','pipe replacement','repipe','broken pipe','copper pipe','pex pipe'], related: ['fittings','pex','copper','abs','insulation','hanger','shutoff valve','solder','drywall patch'], trade: 'Plumber' },
  'water softener': { syn: ['water softener','softener install','hard water','water treatment','water conditioner'], related: ['bypass valve','drain line','salt','plumbing'], trade: 'Plumber' },
  'backflow':       { syn: ['backflow preventer','backflow test','rpz test','backflow device','annual backflow'], related: ['test','certification','permit'], trade: 'Plumber' },
  'hose bib':       { syn: ['hose bib','outdoor faucet','exterior faucet','garden faucet','frost free','hose spigot'], related: ['pipe','insulation','shutoff valve','frost protection'], trade: 'Plumber' },
  dishwasher:       { syn: ['dishwasher hookup','dishwasher connection','dishwasher install','dishwasher plumbing'], related: ['supply line','drain hose','air gap','shutoff valve'], trade: 'Plumber' },
  'laundry plumbing':{ syn: ['laundry hookup','washing machine hookup','washer hookup','laundry connection','washer box'], related: ['supply valve','drain','laundry box','hoses'], trade: 'Plumber' },
  bidet:            { syn: ['bidet','bidet seat','bidet install','washlet','bidet attachment'], related: ['supply line','t-valve','mounting'], trade: 'Plumber' },
  'tub spout':      { syn: ['tub spout','diverter','tub faucet spout','spout diverter','tub diverter'], related: ['shower valve','cartridge','trim kit','caulk'], trade: 'Plumber' },
  'water pressure': { syn: ['low water pressure','water pressure','weak flow','low flow','no pressure','pressure problem'], related: ['prv','pressure reducing valve','shutoff valve','pipe','pressure test'], trade: 'Plumber' },
  'drain pipe':     { syn: ['drain pipe','kitchen drain pipe','drain pipes','replace drain','drain replacement','drain line'], related: ['p-trap','abs','pvc','fittings','cleanout','cement'], trade: 'Plumber' },
  'fridge water':   { syn: ['fridge water line','fridge line','ice maker line','refrigerator line','fridge hookup','fridge water','water line to fridge','ice maker','fridge supply'], related: ['saddle valve','shutoff valve','copper tubing','braided line'], trade: 'Plumber' },
  'sewer':          { syn: ['sewer backup','sewage backup','sewer line','sewer repair','sewer clog','main sewer','sewage'], related: ['cleanout','camera','auger','hydro jet','backflow valve'], trade: 'Plumber' },
  'floor drain':    { syn: ['floor drain','floor drain install','laundry drain','utility drain','basement floor drain'], related: ['trap primer','p-trap','abs pipe','concrete cutting'], trade: 'Plumber' },

  // ── ELECTRICAL OBJECTS (primary target trade) ──
  outlet:           { syn: ['outlet','receptacle','wall outlet','plug outlet','dead outlet','outlet not working','add outlet'], related: ['wire','box','cover plate','breaker','romex'], trade: 'Electrician' },
  'gfci':           { syn: ['gfci','gfci outlet','gfi outlet','ground fault outlet','gfci receptacle'], related: ['outlet','wire','box','bathroom','kitchen','exterior'], trade: 'Electrician' },
  switch:           { syn: ['light switch','dimmer switch','switch install','switch replace','three way switch','3-way switch'], related: ['wire','box','cover plate','dimmer'], trade: 'Electrician' },
  panel:            { syn: ['panel','electrical panel','breaker panel','panel upgrade','fuse box','panel replacement','200 amp','100 amp','service upgrade','main panel'], related: ['breaker','wire','ground rod','surge protector','subpanel','meter','disconnect'], trade: 'Electrician' },
  breaker:          { syn: ['circuit breaker','breaker keeps tripping','tripping breaker','replace breaker','breaker replacement','afci breaker'], related: ['panel','wire','afci','gfci breaker','load'], trade: 'Electrician' },
  light:            { syn: ['light fixture','ceiling light','light install','flush mount light','chandelier install','light not working'], related: ['wire','switch','bulb','box','dimmer'], trade: 'Electrician' },
  'pot light':      { syn: ['pot light','recessed light','can light','pot lamp','led pot light','recessed lighting','wafer light'], related: ['wire','switch','dimmer','box','led','hole saw'], trade: 'Electrician' },
  'pendant light':  { syn: ['pendant light','pendant install','island light','hanging light','pendant fixture'], related: ['wire','switch','box','dimmer','ceiling box'], trade: 'Electrician' },
  'ceiling fan':    { syn: ['ceiling fan','ceiling fan install','fan with light','paddle fan','ceiling fan replace'], related: ['wire','switch','box','bracket','remote','fan brace'], trade: 'Electrician' },
  'ev charger':     { syn: ['ev charger','electric vehicle charger','charging station','level 2 charger','tesla charger','ev outlet','car charger','nema 14-50'], related: ['240v outlet','breaker','disconnect','wire','conduit'], trade: 'Electrician' },
  'power':          { syn: ['no power','power outage','lost power','half power','partial power','no electricity','power failure','dead circuit'], related: ['breaker','panel','wire','troubleshoot','diagnostic','meter'], trade: 'Electrician' },
  'subpanel':       { syn: ['subpanel','sub panel','sub-panel','garage panel','workshop panel','detached garage power'], related: ['breaker','wire','conduit','trench','disconnect','ground rod'], trade: 'Electrician' },
  'smoke detector': { syn: ['smoke detector','co detector','smoke alarm','carbon monoxide alarm','fire alarm','smoke alarm replace'], related: ['wire','interconnect','battery','hardwired'], trade: 'Electrician' },
  'exhaust fan':    { syn: ['exhaust fan','bathroom exhaust','bath exhaust fan','ventilation fan','bathroom vent fan'], related: ['duct','switch','timer','wire','damper'], trade: 'Electrician' },
  'outdoor light':  { syn: ['outdoor light','exterior light','porch light','security light','motion light','flood light','landscape light','soffit light'], related: ['wire','box','motion sensor','photocell','weatherproof box'], trade: 'Electrician' },
  'under cabinet light': { syn: ['under cabinet light','under cabinet lighting','cabinet light','puck light','led under cabinet'], related: ['wire','switch','led strip','transformer'], trade: 'Electrician' },
  'hot tub wiring': { syn: ['hot tub wiring','hot tub','spa wiring','hot tub electrical','jacuzzi wiring','spa circuit','wire hot tub','hot tub install','spa electrical'], related: ['wire','disconnect','gfci breaker','conduit'], trade: 'Electrician' },
  'doorbell':       { syn: ['doorbell','smart doorbell','ring doorbell','video doorbell','doorbell install'], related: ['transformer','wire','chime'], trade: 'Electrician' },
  'data cable':     { syn: ['ethernet','cat6','data cable','network cable','ethernet run','cat6 install'], related: ['cable','keystone','wall plate','patch panel'], trade: 'Electrician' },
  'subpanel':       { syn: ['subpanel','sub panel','secondary panel','garage panel','shop panel'], related: ['wire','breaker','conduit','ground'], trade: 'Electrician' },
  'whole home rewire': { syn: ['rewire','house rewire','whole home rewire','knob and tube','old wiring','update wiring'], related: ['wire','panel','outlet','switch','box','permit'], trade: 'Electrician' },
  'generator':      { syn: ['generator hookup','generator install','backup generator','transfer switch install','generator connection','standby generator'], related: ['transfer switch','panel','breaker','interlock','wire'], trade: 'Electrician' },
  'security camera': { syn: ['security camera','camera install','surveillance','cctv','security system','camera wiring','ring camera'], related: ['wire','low voltage','conduit','power supply','network cable'], trade: 'Electrician' },
  'garage wiring':  { syn: ['wire garage','garage wiring','garage electrical','wire new garage','garage circuit','garage outlets'], related: ['wire','outlet','light','breaker','panel','conduit','subpanel'], trade: 'Electrician' },
  'dedicated circuit': { syn: ['dedicated circuit','add circuit','new circuit','fridge circuit','appliance circuit','dedicated line'], related: ['wire','breaker','panel','outlet'], trade: 'Electrician' },
  'bathroom fan':   { syn: ['bathroom fan','bath fan','bathroom fan install','bath fan install','bathroom exhaust install','bath fan replace','bathroom ventilation','fan light combo','bathroom exhaust fan'], related: ['duct','vent cap','switch','timer','wire','damper'], trade: 'Electrician' },

  // ── HVAC OBJECTS (primary target trade) ──
  furnace:          { syn: ['furnace','furnace repair','furnace install','furnace replace','gas furnace','furnace not working','no heat furnace','furnace diagnostic'], related: ['thermostat','filter','vent pipe','gas line','ignitor','blower motor','flame sensor','control board','gas valve','pressure switch'], trade: 'HVAC' },
  'air conditioner':{ syn: ['air conditioner','air conditioning','central air','ac unit','ac condenser','ac install','ac replace','ac not cooling','ac repair','no cooling','central ac','new ac'], related: ['thermostat','refrigerant','condenser','coil','filter','capacitor','line set','contactor','condensate'], trade: 'HVAC' },
  condenser:        { syn: ['condenser','outdoor unit','condenser unit','condenser coil','ac condenser','compressor unit'], related: ['refrigerant','line set','pad','disconnect','contactor','capacitor','fan motor'], trade: 'HVAC' },
  thermostat:       { syn: ['thermostat','smart thermostat','nest thermostat','ecobee','honeywell thermostat','programmable thermostat','thermostat install','thermostat replace'], related: ['thermostat wire','c-wire','batteries','wall plate'], trade: 'HVAC' },
  'heat pump':      { syn: ['heat pump','air source heat pump','heat pump install','heat pump replace','hybrid system'], related: ['line set','thermostat','condenser','indoor unit','outdoor unit','defrost board'], trade: 'HVAC' },
  'mini split':     { syn: ['mini split','ductless mini split','ductless system','wall mount mini split','mitsubishi mini split','ductless heat pump'], related: ['line set','outdoor unit','indoor unit','disconnect','condensate pump','wall bracket'], trade: 'HVAC' },
  ductwork:         { syn: ['ductwork','duct install','duct repair','duct modification','hvac duct','air duct','duct leak','ductwork install'], related: ['register','grille','damper','duct tape','flex duct','mastic','sheet metal','insulation'], trade: 'HVAC' },
  humidifier:       { syn: ['humidifier','whole home humidifier','humidifier install','humidifier replace','humidifier pad','furnace humidifier'], related: ['water panel','humidifier pad','solenoid valve','bypass damper','water line'], trade: 'HVAC' },
  boiler:           { syn: ['boiler','boiler repair','boiler install','boiler service','hot water boiler','hydronic boiler','boiler not working'], related: ['circulator pump','expansion tank','zone valve','pressure relief','aquastat'], trade: 'HVAC' },
  'garage heater':  { syn: ['garage heater','shop heater','unit heater','overhead heater','garage heat install'], related: ['gas line','thermostat','vent pipe','gas connector'], trade: 'HVAC' },
  'hrv':            { syn: ['hrv','erv','heat recovery ventilator','energy recovery ventilator','air exchanger','hrv install','hrv service'], related: ['duct','filter','core','defrost','condensate'], trade: 'HVAC' },
  'fireplace':      { syn: ['gas fireplace','fireplace install','fireplace repair','fireplace service','pilot light','fireplace insert'], related: ['gas line','venting','thermostat','remote','gas valve'], trade: 'HVAC' },
  'refrigerant':    { syn: ['refrigerant','recharge','freon','r410a','low refrigerant','refrigerant leak','ac charge','ac freezing','frozen coil','ice on coil','iced up','froze up'], related: ['leak detection','dye test','scale','gauge','coil','condenser'], trade: 'HVAC' },
  'contactor':      { syn: ['ac contactor','contactor replace','contactor repair','contactor burned'], related: ['capacitor','condenser','wire','ac repair'], trade: 'HVAC' },
  'airflow':        { syn: ['hot and cold spots','uneven heating','uneven cooling','airflow problem','airflow balance','hot cold rooms','one room cold','one room hot'], related: ['damper','register','duct','duct sealing','balancing'], trade: 'HVAC' },
  'ac warm air':    { syn: ['ac not blowing cold','ac blowing warm','ac not cooling','warm air from ac','ac warm air','no cold air'], related: ['refrigerant','capacitor','contactor','compressor','thermostat','filter'], trade: 'HVAC' },

  // ── CARPENTRY OBJECTS ──
  door:             { syn: ['interior door','bedroom door','closet door','prehung door','door install','door replace','door adjustment','sticking door'], related: ['hardware','hinge','casing','trim','lockset','strike plate'], trade: 'Carpenter' },
  'exterior door':  { syn: ['exterior door','entry door','front door','steel door','storm door','patio door'], related: ['weatherstrip','hardware','threshold','deadbolt','casing'], trade: 'Carpenter' },
  baseboard:        { syn: ['baseboard','base moulding','baseboards','base trim','baseboard install'], related: ['casing','trim','nails','caulk','shoe moulding','wood filler'], trade: 'Carpenter' },
  'crown moulding': { syn: ['crown moulding','crown molding','cornice','ceiling moulding'], related: ['nails','caulk','corner blocks'], trade: 'Carpenter' },
  deck:             { syn: ['deck','patio deck','wooden deck','composite deck','deck build','deck repair'], related: ['railing','deck boards','screws','stain','joist','post','stairs','lattice'], trade: 'Carpenter' },
  fence:            { syn: ['fence','privacy fence','wood fence','cedar fence','fence build','fence repair','fence install'], related: ['post','rail','boards','concrete','hardware','gate','stain'], trade: 'Carpenter' },
  drywall:          { syn: ['drywall','gyproc','sheetrock','gypsum','drywall patch','drywall repair'], related: ['mud','tape','corner bead','screws','skim coat'], trade: 'Carpenter' },
  flooring:         { syn: ['flooring','laminate floor','hardwood floor','vinyl plank','lvp floor','tile floor','floor install'], related: ['underlayment','transition','baseboard','subfloor'], trade: 'Carpenter' },
  window:           { syn: ['window install','window replace','replacement window','new window'], related: ['casing','trim','caulk','insulation','weatherstrip'], trade: 'Carpenter' },
  shelving:         { syn: ['shelving','shelves','shelf install','bookshelf','closet shelves','custom shelving'], related: ['bracket','screws','level','hardware'], trade: 'Carpenter' },
  railing:          { syn: ['railing','handrail','stair rail','deck railing','bannister','baluster'], related: ['post','spindle','hardware','screws'], trade: 'Carpenter' },
  stairs:           { syn: ['stair repair','stair tread','riser','staircase','squeaky stairs','stair rebuild'], related: ['tread','riser','stringer','nosing','railing'], trade: 'Carpenter' },

  // ── ROOFING OBJECTS ──
  shingle:          { syn: ['shingle','roof shingle','asphalt shingle','architectural shingle','missing shingle','wind damage'], related: ['underlayment','flashing','ridge vent','nails','ice shield'], trade: 'Roofing' },
  flashing:         { syn: ['flashing','step flashing','counter flashing','roof flashing','flashing repair','flashing leak'], related: ['sealant','shingle','vent boot','drip edge'], trade: 'Roofing' },
  gutter:           { syn: ['gutter','eavestrough','downspout','rain gutter','gutter repair','gutter install'], related: ['gutter guard','sealant','hanger','elbow','end cap'], trade: 'Roofing' },
  soffit:           { syn: ['soffit','fascia','soffit panel','fascia board','soffit repair'], related: ['ventilation','nails','j-channel','aluminum'], trade: 'Roofing' },
  skylight:         { syn: ['skylight','roof window','velux','sun tunnel','skylight leak'], related: ['flashing','frame','caulk'], trade: 'Roofing' },
  chimney:          { syn: ['chimney','chimney cap','chimney flashing','chimney leak','chimney repair'], related: ['flashing','cap','sealant','mortar'], trade: 'Roofing' },
  'vent boot':      { syn: ['vent boot','pipe boot','roof vent boot','pipe collar','plumbing vent boot'], related: ['sealant','caulk','nails'], trade: 'Roofing' },

  // ── PAINTER OBJECTS ──
  'room paint':     { syn: ['paint room','paint walls','wall paint','interior paint','repaint room','paint ceiling','paint bedroom','paint living room'], related: ['primer','caulk','filler','tape','drop cloth','roller','brush','sandpaper'], trade: 'Painter' },
  'trim paint':     { syn: ['paint trim','paint baseboard','paint casing','paint moulding','trim paint','paint doors'], related: ['primer','sandpaper','caulk','brush','wood filler'], trade: 'Painter' },
  cabinet:          { syn: ['cabinet paint','cabinet refinish','cabinet spray','paint cabinets','kitchen cabinet paint'], related: ['primer','paint','sandpaper','hardware','bonding primer'], trade: 'Painter' },
  'exterior paint': { syn: ['exterior paint','house paint','paint outside','siding paint','paint house','exterior repaint'], related: ['primer','caulk','scraper','power wash','drop cloth'], trade: 'Painter' },
  'deck stain':     { syn: ['deck stain','stain deck','deck seal','deck refinish','fence stain','stain fence'], related: ['stain','sealer','cleaner','brush','roller'], trade: 'Painter' },
  wallpaper:        { syn: ['wallpaper removal','strip wallpaper','remove wallpaper','wallpaper strip'], related: ['scraper','steamer','adhesive','primer'], trade: 'Painter' },

  // ── LANDSCAPING OBJECTS ──
  lawn:             { syn: ['lawn care','lawn mowing','grass cutting','lawn repair','sod install','lawn maintenance'], related: ['mowing','fertilizer','seed','aeration','sod'], trade: 'Landscaping' },
  patio:            { syn: ['patio','paver patio','interlock patio','stone patio','patio install'], related: ['pavers','sand','gravel','edging','base'], trade: 'Landscaping' },
  'garden bed':     { syn: ['garden bed','flower bed','garden install','planting bed','mulch bed'], related: ['mulch','edging','soil','plants','fabric'], trade: 'Landscaping' },
  tree:             { syn: ['tree pruning','tree removal','tree planting','tree trim','tree service'], related: ['pruning','stump','mulch','stakes'], trade: 'Landscaping' },
  irrigation:       { syn: ['irrigation','sprinkler system','drip system','sprinkler install','irrigation repair'], related: ['heads','valve','timer','pipe','blowout'], trade: 'Landscaping' },
  'retaining wall': { syn: ['retaining wall','garden wall','landscape wall','block wall','retaining wall build'], related: ['block','gravel','drainage','fabric','cap'], trade: 'Landscaping' },

  // ── COMMERCIAL OBJECTS ──
  'grease trap':       { syn: ['grease trap','grease interceptor','restaurant trap','commercial kitchen trap'], related: ['drain','cleanout','waste line'], trade: 'Plumber' },
  urinal:              { syn: ['urinal','urinal install','urinal replace','flush valve','flushometer','washroom urinal'], related: ['flush valve','drain','supply line','shutoff valve'], trade: 'Plumber' },
  'booster pump':      { syn: ['booster pump','pressure booster','water booster','building pump','water pressure pump'], related: ['check valve','isolation valve','pressure gauge','pipe'], trade: 'Plumber' },
  'eye wash':          { syn: ['eye wash','eye wash station','emergency shower','safety shower','emergency eye wash'], related: ['drain','supply line','signage'], trade: 'Plumber' },
  'three phase':       { syn: ['three phase','3 phase','three phase power','3 phase power','industrial power','commercial power'], related: ['panel','breaker','wire','conduit','disconnect'], trade: 'Electrician' },
  'emergency light':   { syn: ['emergency lighting','emergency light','egress lighting','battery backup light'], related: ['battery','exit sign','wire'], trade: 'Electrician' },
  'exit sign':         { syn: ['exit sign','exit light','illuminated exit','egress sign','led exit'], related: ['emergency light','battery','wire'], trade: 'Electrician' },
  'fire alarm':        { syn: ['fire alarm','fire alarm panel','fire alarm system','smoke alarm commercial','pull station','heat detector'], related: ['smoke detector','pull station','heat detector','horn','strobe','wire'], trade: 'Electrician' },
  'tenant space':      { syn: ['tenant improvement','tenant buildout','ti buildout','leasehold improvement','commercial buildout','tenant space','tenant fit out','strip mall unit'], related: ['framing','drywall','door','flooring','paint','drop ceiling','partition wall'], trade: 'General Contractor' },
  'partition wall':    { syn: ['partition wall','office wall','divider wall','demising wall','interior wall','office partition'], related: ['framing','drywall','door','insulation','tape and mud'], trade: 'General Contractor' },
  'drop ceiling':      { syn: ['drop ceiling','suspended ceiling','t-bar ceiling','acoustic ceiling','ceiling tiles','ceiling grid'], related: ['grid','tiles','wire','hanger'], trade: 'General Contractor' },
  'concrete pad':      { syn: ['concrete pad','equipment pad','concrete pour','slab pour','concrete slab','dumpster pad'], related: ['forms','rebar','gravel','finish'], trade: 'General Contractor' },
  'toilet partition':  { syn: ['toilet partition','bathroom partition','washroom stall','stall divider','bathroom stall'], related: ['pilaster','door','hardware','panel'], trade: 'General Contractor' },
  storefront:          { syn: ['storefront','storefront glass','glass door','aluminum storefront','commercial entry','shop front'], related: ['glass','frame','door','closer','hardware'], trade: 'General Contractor' },
  'parking lot':       { syn: ['parking lot','parking lot lights','lot lighting','wall pack','pole light','exterior commercial'], related: ['pole','fixture','wire','conduit','photocell'], trade: 'Electrician' },
  'data cable':        { syn: ['data cabling','cat6','cat 6','ethernet','network cable','data drop','network drop','structured cabling'], related: ['patch panel','keystone','faceplate','cable','conduit'], trade: 'Electrician' },
};

// ── LOCATIONS ──
// Where in the building the work happens
const LOCATIONS = {
  kitchen:    { syn: ['kitchen','kitch'], objects: ['kitchen sink','kitchen faucet','garburator','dishwasher','cabinet','range hood','pot filler'] },
  bathroom:   { syn: ['bathroom','bath','washroom','ensuite','en-suite','powder room','half bath'], objects: ['toilet','bathroom faucet','shower','tub','exhaust fan','vanity'] },
  basement:   { syn: ['basement','cellar','lower level'], objects: ['sump pump','drain','pipe','framing','drywall'] },
  garage:     { syn: ['garage','carport'], objects: ['outlet','ev charger','light','door','heater'] },
  exterior:   { syn: ['exterior','outside','outdoor','front','back yard','backyard'], objects: ['hose bib','gutter','soffit','flashing','deck','fence','light'] },
  attic:      { syn: ['attic','loft','roof space'], objects: ['insulation','ventilation','ductwork'] },
  laundry:    { syn: ['laundry','laundry room','utility room','mud room'], objects: ['laundry connections','drain','outlet','faucet'] },
};

// ═══════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract structured job context from free-text description.
 * Returns: { trade, jobType, objects[], locations[], keywords[] }
 *
 * Example: "replace kitchen sink and faucet" →
 *   { trade: 'Plumber', jobType: 'replace',
 *     objects: ['kitchen sink','kitchen faucet'],
 *     locations: ['kitchen'],
 *     keywords: ['replace','kitchen','sink','faucet'] }
 */
export function extractJobContext(description, selectedTrade = 'Other') {
  const text = String(description || '').toLowerCase().trim();
  if (!text) return { trade: selectedTrade, jobType: null, objects: [], locations: [], keywords: [], confidence: 0 };

  // 1. Detect job type
  let jobType = null;
  for (const [type, pattern] of Object.entries(JOB_TYPE_PATTERNS)) {
    if (pattern.test(text)) { jobType = type; break; }
  }

  // Helper: word-boundary-aware match to prevent "ac" matching inside "replace"
  function wordMatch(text, term) {
    if (term.length <= 2) {
      // Short terms need strict word boundary: space or start/end
      const re = new RegExp(`(?:^|\\s|/)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|/|$)`, 'i');
      return re.test(text);
    }
    return text.includes(term.toLowerCase());
  }

  // 2. Detect objects (check multi-word first, then single-word)
  const foundObjects = [];
  const objectEntries = Object.entries(OBJECTS).sort((a, b) => b[0].length - a[0].length); // longest first
  for (const [objKey, objDef] of objectEntries) {
    const matched = objDef.syn.some(s => wordMatch(text, s));
    if (matched && !foundObjects.includes(objKey)) {
      foundObjects.push(objKey);
    }
  }
  // Deduplicate: if "kitchen sink" found, remove generic "sink"
  const deduped = foundObjects.filter(obj => {
    return !foundObjects.some(other => other !== obj && other.includes(obj) && other.length > obj.length);
  });

  // 3. Detect locations
  const foundLocations = [];
  for (const [locKey, locDef] of Object.entries(LOCATIONS)) {
    if (locDef.syn.some(s => wordMatch(text, s))) {
      foundLocations.push(locKey);
    }
  }

  // 4. Infer trade from objects if selectedTrade is 'Other'
  let trade = selectedTrade;
  if (trade === 'Other' && deduped.length > 0) {
    const tradeCounts = {};
    for (const obj of deduped) {
      const t = OBJECTS[obj]?.trade;
      if (t) tradeCounts[t] = (tradeCounts[t] || 0) + 1;
    }
    const sorted = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) trade = sorted[0][0];
  }

  // 5. Extract keywords (non-stop-words)
  const STOP = new Set(['the','a','an','and','or','for','to','in','on','at','of','with','from','by','is','are','was','it','my','our','this','that','need','needs','job','work','new','old','get','has','have','do','does','want','wants','like','would','can','could','should','also','just','some','very','too','been','being','had','will','about','into','them','than','each','but','not','they']);
  const keywords = text.split(/\s+/)
    .map(w => w.replace(/[^a-z0-9-]/g, ''))
    .filter(w => w.length > 2 && !STOP.has(w));

  // 6. Confidence score (0-100): how well do we understand this job?
  let confidence = 0;
  if (trade !== 'Other') confidence += 30;
  if (jobType) confidence += 20;
  if (deduped.length > 0) confidence += 30;
  if (foundLocations.length > 0) confidence += 10;
  if (keywords.length >= 3) confidence += 10;

  return {
    trade,
    jobType,
    objects: deduped,
    locations: foundLocations,
    keywords,
    confidence,
  };
}

/**
 * Get related object keywords for catalog matching.
 * For "kitchen sink" → returns: ['sink','faucet','p-trap','drain','supply line','garburator','caulk','shutoff valve']
 */
export function getRelatedObjects(objects) {
  const related = new Set();
  for (const obj of objects) {
    const def = OBJECTS[obj];
    if (def) {
      // Add synonyms as matching terms
      for (const s of def.syn) related.add(s);
      // Add related objects
      for (const r of def.related) related.add(r);
    }
  }
  return [...related];
}

/**
 * Get objects associated with a location.
 */
export function getLocationObjects(locations) {
  const objs = new Set();
  for (const loc of locations) {
    const def = LOCATIONS[loc];
    if (def) {
      for (const o of def.objects) objs.add(o);
    }
  }
  return [...objs];
}

// ── Export taxonomy for external use ──
export { OBJECTS, LOCATIONS, JOB_TYPE_PATTERNS };
