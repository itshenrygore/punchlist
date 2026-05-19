// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — CHECK SCOPE ENGINE
// Client-side scope review for contractor quotes
// 12 jobs · ~264 line items · 4-tier suggestion system
// ═══════════════════════════════════════════════════════════════

// ── JOB SCOPE PATTERNS ──
// Each job defines expected items across 4 categories:
// Core (always/almost always), Often Needed (common but not universal),
// Confirm (situational, site-dependent), Upgrade (optional upsell)

export const JOB_SCOPE_PATTERNS = {

// ═══════════════════════════════════════
// ELECTRICAL
// ═══════════════════════════════════════

ev_charger_install: {
  trade:'Electrical', label:'EV Charger Install', code:'ev_charger_install',
  keywords:['ev charger','ev','electric vehicle','charger','level 2','tesla','charging station','nema 14-50'],
  expected_core:5, expected_total_min:8, expected_total_max:14,
  items:[
    // Core Services
    {cat:'Core',type:'Service',name:'Install and mount EV charger unit',lo:250,hi:450,req:'always',conf:'high',reason:'Primary install labor for charger mounting and connection.',triggers:['ev charger install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Run dedicated 240V circuit (panel to charger location)',lo:350,hi:750,req:'always',conf:'high',reason:'Most EV charger installs require a new dedicated circuit from the panel.',triggers:['no existing 240V circuit at charger location'],excludes:['Suitable dedicated circuit already exists']},
    {cat:'Core',type:'Service',name:'Install 2-pole breaker (40A or 50A) in panel',lo:85,hi:195,req:'always',conf:'high',reason:'Dedicated breaker sized to charger load is required.',triggers:['new circuit being run'],excludes:['Breaker already installed for this circuit']},
    {cat:'Core',type:'Service',name:'Wire termination and connection at charger',lo:85,hi:165,req:'always',conf:'high',reason:'Final wiring connections at the charger unit.',triggers:['charger install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Testing, commissioning, and charge verification',lo:75,hi:150,req:'always',conf:'high',reason:'Verify charger operates correctly and safely before handoff.',triggers:['charger install'],excludes:[]},
    // Core Materials
    {cat:'Core',type:'Material',name:'Electrical wire — 6/3 or 8/3 NMD (panel to charger)',lo:120,hi:350,req:'always',conf:'high',reason:'Wire sized for charger amperage and run distance.',triggers:['new circuit run'],excludes:['Wire already in place']},
    {cat:'Core',type:'Material',name:'2-pole breaker (40A or 50A)',lo:35,hi:85,req:'always',conf:'high',reason:'Breaker matched to charger circuit requirements.',triggers:['new circuit'],excludes:['Existing breaker suitable']},
    {cat:'Core',type:'Material',name:'Connectors, boxes, staples, and cover plates',lo:35,hi:95,req:'always',conf:'high',reason:'Standard electrical install materials.',triggers:['any electrical install'],excludes:[]},
    // Often Needed
    {cat:'Often Needed',type:'Service',name:'Electrical load calculation and panel capacity review',lo:95,hi:195,req:'conditional',conf:'medium',reason:'Confirms panel can support the added load. Common due diligence.',triggers:['ev charger install'],excludes:['Panel capacity already documented']},
    {cat:'Often Needed',type:'Service',name:'Permit and inspection coordination',lo:95,hi:250,req:'conditional',conf:'medium',reason:'Many municipalities require permits for new 240V circuits.',triggers:['new circuit run'],excludes:['Permit not required locally']},
    {cat:'Often Needed',type:'Service',name:'Surface patching after wire run (drywall or finish)',lo:65,hi:195,req:'conditional',conf:'medium',reason:'Wire routing through finished spaces often requires patching.',triggers:['wire run through finished space'],excludes:['Wire routed through unfinished space only']},
    {cat:'Often Needed',type:'Material',name:'Conduit and fittings (if exposed run required)',lo:45,hi:165,req:'conditional',conf:'medium',reason:'Required when wire cannot be concealed in walls.',triggers:['exposed wire run','garage surface mount'],excludes:['Concealed wire run through walls']},
    // Confirm
    {cat:'Confirm',type:'Service',name:'Exterior-rated disconnect switch installation',lo:120,hi:280,req:'conditional',conf:'medium',reason:'Often required for outdoor installs or by local code.',triggers:['charger mounted outdoors','local code requires disconnect'],excludes:['Indoor install without disconnect requirement']},
    {cat:'Confirm',type:'Service',name:'Panel upgrade or additional sub-panel',lo:650,hi:1800,req:'conditional',conf:'low',reason:'Required if existing panel cannot support added charger load.',triggers:['panel at capacity'],excludes:['Panel has sufficient capacity']},
    {cat:'Confirm',type:'Material',name:'GFCI breaker (if required by code)',lo:85,hi:165,req:'conditional',conf:'medium',reason:'Some jurisdictions require GFCI protection for EV circuits.',triggers:['local code requires GFCI'],excludes:['Standard breaker acceptable']},
    // Upgrade
    {cat:'Upgrade',type:'Material',name:'Whole-home surge protection',lo:195,hi:420,req:'optional',conf:'low',reason:'Protects electrical system when adding major new equipment.',triggers:['ev charger install'],excludes:[]},
    {cat:'Upgrade',type:'Service',name:'Smart charger WiFi setup and app configuration',lo:45,hi:95,req:'optional',conf:'low',reason:'Many Level 2 chargers support scheduling and monitoring via app.',triggers:['smart charger selected'],excludes:['Basic charger without WiFi']},
  ]
},

outlet_upgrade: {
  trade:'Electrical', label:'Outlet / Receptacle Work', code:'outlet_upgrade',
  keywords:['outlet','receptacle','plug','gfci','usb outlet','switch','dimmer','device'],
  expected_core:3, expected_total_min:6, expected_total_max:10,
  items:[
    {cat:'Core',type:'Service',name:'Remove existing device and install new outlet or switch',lo:65,hi:165,req:'always',conf:'high',reason:'Primary device swap or new install labor.',triggers:['outlet or switch work'],excludes:[]},
    {cat:'Core',type:'Service',name:'Testing and verification (polarity, ground, GFCI)',lo:35,hi:85,req:'always',conf:'high',reason:'Verify correct wiring and safe operation after install.',triggers:['any device install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Outlet, switch, or GFCI device (standard grade)',lo:8,hi:45,req:'always',conf:'high',reason:'Replacement device matched to location and code.',triggers:['device replacement'],excludes:['Customer supplying device']},
    {cat:'Core',type:'Material',name:'Cover plate (standard or decorator style)',lo:3,hi:15,req:'always',conf:'high',reason:'New cover plate to match new device.',triggers:['device replacement'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'Run new circuit from panel (if no existing circuit)',lo:280,hi:650,req:'conditional',conf:'medium',reason:'Required when adding an outlet where no circuit exists.',triggers:['new outlet location'],excludes:['Existing circuit available']},
    {cat:'Often Needed',type:'Service',name:'GFCI compliance upgrade (bathroom, kitchen, exterior)',lo:45,hi:120,req:'conditional',conf:'high',reason:'Code requires GFCI protection in wet or exterior locations.',triggers:['bathroom','kitchen','garage','exterior','laundry'],excludes:['GFCI already present on circuit']},
    {cat:'Often Needed',type:'Material',name:'Wire, connectors, and box (if new location)',lo:35,hi:95,req:'conditional',conf:'medium',reason:'Materials for new outlet rough-in.',triggers:['new outlet location'],excludes:['Using existing box and wiring']},
    {cat:'Confirm',type:'Service',name:'Drywall patching after new outlet rough-in',lo:55,hi:145,req:'conditional',conf:'medium',reason:'Patching needed when cutting into finished walls.',triggers:['new outlet in finished wall'],excludes:['Open wall or unfinished space']},
    {cat:'Confirm',type:'Service',name:'Panel labelling update',lo:25,hi:65,req:'conditional',conf:'low',reason:'Update panel schedule when adding new circuits.',triggers:['new circuit added'],excludes:['No new circuits']},
    {cat:'Upgrade',type:'Material',name:'USB outlet upgrade (USB-A/C built-in)',lo:25,hi:55,req:'optional',conf:'low',reason:'Convenience upgrade popular in kitchens and bedrooms.',triggers:['customer interested in USB charging'],excludes:[]},
    {cat:'Upgrade',type:'Material',name:'Smart dimmer or WiFi switch',lo:45,hi:95,req:'optional',conf:'low',reason:'Smart home integration for lighting control.',triggers:['lighting control upgrade'],excludes:[]},
  ]
},

panel_upgrade: {
  trade:'Electrical', label:'Electrical Panel Upgrade', code:'panel_upgrade',
  keywords:['panel','panel upgrade','200 amp','service upgrade','breaker panel','fuse','fuse box','main panel'],
  expected_core:5, expected_total_min:10, expected_total_max:16,
  items:[
    {cat:'Core',type:'Service',name:'Disconnect and remove existing panel',lo:250,hi:450,req:'always',conf:'high',reason:'Safe de-energization and removal of old panel.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Core',type:'Service',name:'Install new panel and reconnect all circuits',lo:800,hi:1800,req:'always',conf:'high',reason:'Mount new panel, reconnect all existing branch circuits.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Core',type:'Service',name:'Utility coordination (disconnect and reconnect)',lo:95,hi:250,req:'always',conf:'high',reason:'Coordinate with utility for safe service disconnect.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Core',type:'Service',name:'Final testing, labelling, and panel schedule',lo:95,hi:195,req:'always',conf:'high',reason:'Full panel verification, breaker labelling, and schedule update.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Core',type:'Service',name:'Permit and ESA inspection',lo:150,hi:350,req:'always',conf:'high',reason:'Panel upgrades require permit and inspection in all jurisdictions.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Core',type:'Material',name:'200A panel and main breaker',lo:350,hi:750,req:'always',conf:'high',reason:'New panel enclosure with main breaker.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Core',type:'Material',name:'Branch circuit breakers (matched to existing circuits)',lo:120,hi:350,req:'always',conf:'high',reason:'New breakers to replace all existing circuits.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'Upgrade service entrance cable',lo:250,hi:550,req:'conditional',conf:'medium',reason:'Often required when upgrading from 100A to 200A service.',triggers:['amperage upgrade'],excludes:['Existing SEC rated for new amperage']},
    {cat:'Often Needed',type:'Service',name:'Upgrade meter base',lo:195,hi:420,req:'conditional',conf:'medium',reason:'Older meter bases may not support higher amperage.',triggers:['amperage upgrade'],excludes:['Meter base already rated']},
    {cat:'Often Needed',type:'Service',name:'Ground rod and bonding upgrade',lo:95,hi:220,req:'conditional',conf:'medium',reason:'Grounding system may need upgrade to meet current code.',triggers:['panel upgrade'],excludes:['Grounding already compliant']},
    {cat:'Often Needed',type:'Material',name:'Service entrance cable and fittings',lo:120,hi:350,req:'conditional',conf:'medium',reason:'New SEC if amperage is being increased.',triggers:['amperage upgrade'],excludes:[]},
    {cat:'Often Needed',type:'Material',name:'Grounding materials (rod, clamp, conductor)',lo:45,hi:120,req:'conditional',conf:'medium',reason:'Grounding system materials.',triggers:['grounding upgrade needed'],excludes:[]},
    {cat:'Confirm',type:'Service',name:'AFCI breaker upgrade for bedroom circuits',lo:120,hi:320,req:'conditional',conf:'medium',reason:'Current code may require AFCI protection on bedroom circuits.',triggers:['panel upgrade'],excludes:['AFCI not required by local code']},
    {cat:'Confirm',type:'Service',name:'Drywall or finish repair around panel area',lo:65,hi:195,req:'conditional',conf:'low',reason:'Panel relocation or resizing may require wall repair.',triggers:['panel relocated or resized'],excludes:['Panel in same location and size']},
    {cat:'Upgrade',type:'Material',name:'Whole-home surge protection device',lo:195,hi:420,req:'optional',conf:'low',reason:'Protect home electronics during panel upgrade.',triggers:['panel upgrade'],excludes:[]},
    {cat:'Upgrade',type:'Service',name:'EV charger circuit pre-wire',lo:280,hi:550,req:'optional',conf:'low',reason:'Good time to add future EV circuit while panel is open.',triggers:['customer has or plans EV'],excludes:[]},
  ]
},

pot_light_install: {
  trade:'Electrical', label:'Pot Light / Recessed Lighting Install', code:'pot_light_install',
  keywords:['pot light','recessed light','can light','wafer light','led pot','recessed','pot lights'],
  expected_core:4, expected_total_min:7, expected_total_max:12,
  items:[
    {cat:'Core',type:'Service',name:'Cut openings and install recessed LED pot lights',lo:85,hi:175,req:'always',conf:'high',reason:'Per-light install labor including hole cutting and mounting.',triggers:['pot light install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Wire and connect pot light circuit',lo:180,hi:420,req:'always',conf:'high',reason:'Wiring from switch or junction to all light locations.',triggers:['pot light install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Install or replace wall switch (dimmer-compatible)',lo:65,hi:145,req:'always',conf:'high',reason:'Switch or dimmer to control the new lights.',triggers:['pot light install'],excludes:['Using existing switch']},
    {cat:'Core',type:'Service',name:'Testing, dimmer adjustment, and cleanup',lo:45,hi:95,req:'always',conf:'high',reason:'Verify all lights work, set dimmer range, clean up.',triggers:['pot light install'],excludes:[]},
    {cat:'Core',type:'Material',name:'LED pot light fixtures (per light)',lo:15,hi:45,req:'always',conf:'high',reason:'Slim LED wafer or IC-rated recessed fixtures.',triggers:['pot light install'],excludes:['Customer supplying fixtures']},
    {cat:'Core',type:'Material',name:'Wire, connectors, and junction boxes',lo:45,hi:130,req:'always',conf:'high',reason:'Wiring materials for the run.',triggers:['pot light install'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'Drywall patching after wire routing',lo:55,hi:165,req:'conditional',conf:'medium',reason:'Fishing wire through finished ceilings often requires access patches.',triggers:['finished ceiling installation'],excludes:['Open ceiling or new construction']},
    {cat:'Often Needed',type:'Service',name:'Remove existing light fixture',lo:35,hi:85,req:'conditional',conf:'medium',reason:'Remove old fixture being replaced by pot lights.',triggers:['replacing existing fixture'],excludes:['No existing fixture']},
    {cat:'Often Needed',type:'Material',name:'Dimmer switch (LED-compatible)',lo:25,hi:65,req:'conditional',conf:'high',reason:'Most pot light installs include a dimmer for ambiance control.',triggers:['pot light install'],excludes:['Customer does not want dimmer']},
    {cat:'Confirm',type:'Service',name:'Insulation management around fixtures',lo:45,hi:120,req:'conditional',conf:'medium',reason:'IC-rated fixtures needed if insulation contacts housing.',triggers:['insulated ceiling'],excludes:['No insulation contact']},
    {cat:'Confirm',type:'Service',name:'Permit (if new circuit required)',lo:95,hi:195,req:'conditional',conf:'low',reason:'New circuits typically require permit.',triggers:['new circuit added'],excludes:['Using existing circuit']},
    {cat:'Upgrade',type:'Material',name:'Smart dimmer with WiFi/app control',lo:55,hi:120,req:'optional',conf:'low',reason:'App-controllable dimming for modern lighting control.',triggers:['smart home interest'],excludes:[]},
  ]
},

// ═══════════════════════════════════════
// HVAC
// ═══════════════════════════════════════

furnace_install: {
  trade:'HVAC', label:'Furnace Install / Replacement', code:'furnace_install',
  keywords:['furnace install','furnace replacement','new furnace','replace furnace','gas furnace install','high efficiency furnace'],
  expected_core:5, expected_total_min:10, expected_total_max:16,
  items:[
    {cat:'Core',type:'Service',name:'Remove and dispose of existing furnace',lo:250,hi:450,req:'always',conf:'high',reason:'Disconnect, remove, and haul away old furnace.',triggers:['furnace replacement'],excludes:['New install with no existing unit']},
    {cat:'Core',type:'Service',name:'Install and connect new furnace',lo:650,hi:1400,req:'always',conf:'high',reason:'Set, level, connect gas, vent, electrical, and ductwork.',triggers:['furnace install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Startup, commissioning, and safety testing',lo:120,hi:250,req:'always',conf:'high',reason:'First-fire startup, gas leak check, combustion analysis, airflow verification.',triggers:['furnace install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Permit and inspection',lo:120,hi:280,req:'always',conf:'high',reason:'Gas furnace installs require permit and inspection.',triggers:['furnace install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Thermostat reconnection or replacement',lo:65,hi:165,req:'always',conf:'high',reason:'Reconnect existing thermostat or install new one.',triggers:['furnace install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Venting materials (pipe, elbows, termination)',lo:120,hi:350,req:'always',conf:'high',reason:'Vent pipe and fittings for exhaust — PVC for high-efficiency, B-vent for standard.',triggers:['furnace install'],excludes:['Existing venting fully compatible']},
    {cat:'Core',type:'Material',name:'Gas connector and fittings',lo:35,hi:85,req:'always',conf:'high',reason:'Flexible gas connector and shutoff valve.',triggers:['gas furnace install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Condensate drain materials (high-efficiency units)',lo:25,hi:75,req:'conditional',conf:'high',reason:'High-efficiency furnaces produce condensate that must be drained.',triggers:['high efficiency furnace'],excludes:['Standard efficiency unit']},
    {cat:'Often Needed',type:'Service',name:'Duct transition and adaptation',lo:120,hi:320,req:'conditional',conf:'medium',reason:'New furnace dimensions often differ — transitions needed.',triggers:['different size unit'],excludes:['Exact replacement dimensions']},
    {cat:'Often Needed',type:'Service',name:'Condensate pump or drain routing',lo:95,hi:220,req:'conditional',conf:'medium',reason:'Condensate line routing when gravity drain is not available.',triggers:['high efficiency','no floor drain nearby'],excludes:['Floor drain adjacent']},
    {cat:'Often Needed',type:'Material',name:'Filter (matched to new unit)',lo:15,hi:55,req:'conditional',conf:'high',reason:'Provide initial filter sized for the new furnace.',triggers:['furnace install'],excludes:[]},
    {cat:'Often Needed',type:'Material',name:'HVAC tape, mastic, and sealing materials',lo:25,hi:75,req:'conditional',conf:'medium',reason:'Seal duct connections for efficiency.',triggers:['furnace install'],excludes:[]},
    {cat:'Confirm',type:'Service',name:'Gas line modification or extension',lo:120,hi:350,req:'conditional',conf:'medium',reason:'Gas line may need resizing or rerouting for new unit.',triggers:['different gas requirements'],excludes:['Existing gas line suitable']},
    {cat:'Confirm',type:'Service',name:'Return air modification',lo:120,hi:320,req:'conditional',conf:'medium',reason:'Return ductwork may need adjustment for new unit airflow.',triggers:['different unit configuration'],excludes:['Return air compatible']},
    {cat:'Confirm',type:'Service',name:'Electrical circuit update',lo:85,hi:195,req:'conditional',conf:'low',reason:'Some new furnaces require different electrical connections.',triggers:['different electrical needs'],excludes:['Existing electrical compatible']},
    {cat:'Upgrade',type:'Material',name:'Smart thermostat (Ecobee, Nest, etc.)',lo:120,hi:280,req:'optional',conf:'low',reason:'Upgrade to smart thermostat during furnace replacement.',triggers:['furnace install'],excludes:['Customer keeping existing thermostat']},
    {cat:'Upgrade',type:'Material',name:'Humidifier installation',lo:280,hi:550,req:'optional',conf:'low',reason:'Good time to add whole-home humidifier with new furnace.',triggers:['furnace install','dry air concern'],excludes:[]},
    {cat:'Upgrade',type:'Service',name:'Duct cleaning coordination',lo:280,hi:550,req:'optional',conf:'low',reason:'Duct cleaning often done when installing new equipment.',triggers:['furnace install'],excludes:[]},
  ]
},

ac_install: {
  trade:'HVAC', label:'Central AC Install / Replacement', code:'ac_install',
  keywords:['ac install','air conditioning install','central air install','ac replacement','condenser install','condenser replacement','air conditioner install','air conditioner replacement','new ac','new air conditioner'],
  expected_core:5, expected_total_min:9, expected_total_max:14,
  items:[
    {cat:'Core',type:'Service',name:'Remove and dispose of existing AC unit',lo:195,hi:380,req:'always',conf:'high',reason:'Disconnect, recover refrigerant, remove old condenser.',triggers:['ac replacement'],excludes:['New install with no existing unit']},
    {cat:'Core',type:'Service',name:'Install outdoor condenser unit on pad',lo:450,hi:950,req:'always',conf:'high',reason:'Set condenser, make electrical and refrigerant connections.',triggers:['ac install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Install or replace indoor evaporator coil',lo:250,hi:550,req:'always',conf:'high',reason:'Match new coil to condenser for proper system operation.',triggers:['ac install'],excludes:['Existing coil compatible']},
    {cat:'Core',type:'Service',name:'Refrigerant charge and leak test',lo:120,hi:280,req:'always',conf:'high',reason:'Charge system to specification and verify no leaks.',triggers:['ac install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Startup, commissioning, and performance test',lo:95,hi:195,req:'always',conf:'high',reason:'Verify temperatures, airflow, and proper operation.',triggers:['ac install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Refrigerant line set (insulated)',lo:120,hi:320,req:'always',conf:'high',reason:'Copper line set connecting indoor and outdoor components.',triggers:['ac install'],excludes:['Existing line set reusable']},
    {cat:'Core',type:'Material',name:'Condenser pad',lo:25,hi:65,req:'conditional',conf:'high',reason:'Level pad for outdoor unit.',triggers:['ac install'],excludes:['Existing pad suitable']},
    {cat:'Often Needed',type:'Service',name:'Permit and inspection',lo:95,hi:250,req:'conditional',conf:'medium',reason:'AC installs often require permit depending on jurisdiction.',triggers:['ac install'],excludes:['Permit not required']},
    {cat:'Often Needed',type:'Service',name:'Electrical disconnect installation or upgrade',lo:120,hi:280,req:'conditional',conf:'medium',reason:'Outdoor disconnect required for condenser.',triggers:['ac install'],excludes:['Existing disconnect suitable']},
    {cat:'Often Needed',type:'Material',name:'Electrical whip and disconnect',lo:55,hi:145,req:'conditional',conf:'medium',reason:'Electrical connection materials for outdoor unit.',triggers:['ac install'],excludes:['Existing electrical suitable']},
    {cat:'Often Needed',type:'Material',name:'Condensate drain materials',lo:25,hi:65,req:'conditional',conf:'medium',reason:'Drain line and trap for indoor coil condensate.',triggers:['ac install'],excludes:[]},
    {cat:'Confirm',type:'Service',name:'Duct modifications for coil access',lo:120,hi:320,req:'conditional',conf:'medium',reason:'Access or transition work to fit new coil in plenum.',triggers:['different coil size'],excludes:['Direct replacement fit']},
    {cat:'Confirm',type:'Service',name:'Breaker upgrade for condenser circuit',lo:85,hi:195,req:'conditional',conf:'low',reason:'New unit may require different amperage breaker.',triggers:['different electrical requirements'],excludes:['Existing breaker suitable']},
    {cat:'Upgrade',type:'Material',name:'Smart thermostat',lo:120,hi:280,req:'optional',conf:'low',reason:'Optimize cooling efficiency with smart scheduling.',triggers:['ac install'],excludes:[]},
  ]
},

heat_pump_install: {
  trade:'HVAC', label:'Heat Pump / Mini-Split Install', code:'heat_pump_install',
  keywords:['heat pump','mini split','ductless','cold climate heat pump','split system','mitsubishi','daikin','fujitsu'],
  expected_core:5, expected_total_min:9, expected_total_max:15,
  items:[
    {cat:'Core',type:'Service',name:'Install outdoor heat pump condenser unit',lo:550,hi:1200,req:'always',conf:'high',reason:'Mount and connect outdoor heat pump unit.',triggers:['heat pump install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Install indoor head unit(s) or air handler',lo:350,hi:750,req:'always',conf:'high',reason:'Mount wall-mount head, ceiling cassette, or air handler.',triggers:['heat pump install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Run refrigerant lines and make connections',lo:250,hi:550,req:'always',conf:'high',reason:'Route and connect copper refrigerant lines between units.',triggers:['heat pump install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Electrical connection and dedicated circuit',lo:250,hi:550,req:'always',conf:'high',reason:'Run circuit and make electrical connections to outdoor unit.',triggers:['heat pump install'],excludes:['Existing circuit suitable']},
    {cat:'Core',type:'Service',name:'Vacuum, charge, and commission system',lo:120,hi:280,req:'always',conf:'high',reason:'Pull vacuum, verify charge, test heating and cooling modes.',triggers:['heat pump install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Refrigerant line set and insulation',lo:120,hi:350,req:'always',conf:'high',reason:'Pre-charged or field-charged copper line set.',triggers:['heat pump install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Line hide / cover kit (exterior)',lo:55,hi:145,req:'conditional',conf:'high',reason:'Protective cover for exterior refrigerant lines.',triggers:['visible exterior line run'],excludes:['Lines concealed in wall']},
    {cat:'Often Needed',type:'Service',name:'Core drill through exterior wall',lo:85,hi:195,req:'conditional',conf:'high',reason:'Penetration for refrigerant, drain, and electrical lines.',triggers:['heat pump install'],excludes:['Existing penetration usable']},
    {cat:'Often Needed',type:'Service',name:'Permit and inspection',lo:95,hi:280,req:'conditional',conf:'medium',reason:'Heat pump installs often require HVAC and/or electrical permit.',triggers:['heat pump install'],excludes:['Permit not required']},
    {cat:'Often Needed',type:'Service',name:'Condensate drain routing',lo:55,hi:145,req:'conditional',conf:'medium',reason:'Route condensate drain from indoor unit to drain point.',triggers:['indoor unit produces condensate'],excludes:[]},
    {cat:'Often Needed',type:'Material',name:'Mounting bracket for outdoor unit',lo:45,hi:120,req:'conditional',conf:'medium',reason:'Wall or ground mount bracket for condenser.',triggers:['heat pump install'],excludes:['Ground-level pad placement']},
    {cat:'Confirm',type:'Service',name:'Backup heat integration (existing furnace or electric)',lo:120,hi:320,req:'conditional',conf:'medium',reason:'Configure backup heating source for extreme cold.',triggers:['cold climate','replacing furnace partially'],excludes:['Standalone system']},
    {cat:'Confirm',type:'Service',name:'Exterior wall patching and sealing',lo:55,hi:145,req:'conditional',conf:'low',reason:'Seal and finish around wall penetration.',triggers:['core drill required'],excludes:[]},
    {cat:'Upgrade',type:'Service',name:'Additional indoor head unit',lo:350,hi:750,req:'optional',conf:'low',reason:'Add zone for another room.',triggers:['multi-zone system'],excludes:[]},
    {cat:'Upgrade',type:'Material',name:'WiFi controller / smart thermostat integration',lo:65,hi:165,req:'optional',conf:'low',reason:'App control for scheduling and monitoring.',triggers:['heat pump install'],excludes:[]},
  ]
},

ductwork: {
  trade:'HVAC', label:'Ductwork Modification or Repair', code:'ductwork',
  keywords:['duct','ductwork','duct repair','duct run','new duct','return air','supply duct','air flow'],
  expected_core:3, expected_total_min:6, expected_total_max:11,
  items:[
    {cat:'Core',type:'Service',name:'Duct fabrication and installation labor',lo:250,hi:650,req:'always',conf:'high',reason:'Fabricate and install duct sections and connections.',triggers:['ductwork modification'],excludes:[]},
    {cat:'Core',type:'Service',name:'Seal and insulate new duct connections',lo:85,hi:195,req:'always',conf:'high',reason:'Mastic seal and insulate all joints for efficiency.',triggers:['ductwork'],excludes:[]},
    {cat:'Core',type:'Service',name:'Airflow testing and balancing',lo:75,hi:165,req:'always',conf:'high',reason:'Verify adequate airflow to all registers after modification.',triggers:['ductwork modification'],excludes:[]},
    {cat:'Core',type:'Material',name:'Duct sections, fittings, and transitions',lo:85,hi:280,req:'always',conf:'high',reason:'Round or rectangular duct, elbows, boots, and transitions.',triggers:['ductwork'],excludes:[]},
    {cat:'Core',type:'Material',name:'Mastic sealant, tape, and insulation',lo:35,hi:95,req:'always',conf:'high',reason:'Sealing and insulation materials for all joints.',triggers:['ductwork'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'Access cutting and patching (floors, walls, ceilings)',lo:85,hi:280,req:'conditional',conf:'medium',reason:'Accessing duct runs through finished spaces.',triggers:['finished space access needed'],excludes:['Open access available']},
    {cat:'Often Needed',type:'Service',name:'Remove or reroute existing ductwork',lo:120,hi:320,req:'conditional',conf:'medium',reason:'Old duct sections that need to be removed or rerouted.',triggers:['renovation','reroute required'],excludes:['New run only']},
    {cat:'Often Needed',type:'Material',name:'Register boots and grilles',lo:15,hi:55,req:'conditional',conf:'high',reason:'Floor or wall register for new duct termination.',triggers:['new duct run to room'],excludes:[]},
    {cat:'Confirm',type:'Service',name:'Static pressure test',lo:65,hi:145,req:'conditional',conf:'medium',reason:'Confirm system pressure after duct modification.',triggers:['significant duct change'],excludes:['Minor repair only']},
    {cat:'Confirm',type:'Service',name:'Permit (if modifying HVAC system)',lo:95,hi:195,req:'conditional',conf:'low',reason:'Major duct modifications may require permit.',triggers:['new duct run'],excludes:['Repair or minor modification']},
    {cat:'Upgrade',type:'Service',name:'Duct cleaning after modification',lo:280,hi:550,req:'optional',conf:'low',reason:'Clean system after construction debris enters ductwork.',triggers:['ductwork modification'],excludes:[]},
  ]
},

// ═══════════════════════════════════════
// PLUMBING
// ═══════════════════════════════════════

toilet_install: {
  trade:'Plumbing', label:'Toilet Install / Replacement', code:'toilet_install',
  keywords:['toilet','toilet install','toilet replacement','new toilet','replace toilet','toilet swap'],
  expected_core:4, expected_total_min:7, expected_total_max:12,
  items:[
    {cat:'Core',type:'Service',name:'Remove and dispose of existing toilet',lo:85,hi:165,req:'always',conf:'high',reason:'Disconnect, remove, and haul away old toilet.',triggers:['toilet replacement'],excludes:['New install with no existing toilet']},
    {cat:'Core',type:'Service',name:'Install new toilet (set, level, connect, test)',lo:165,hi:320,req:'always',conf:'high',reason:'Set toilet on flange, level, connect supply, test flush and seal.',triggers:['toilet install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Disposal and cleanup',lo:45,hi:95,req:'always',conf:'high',reason:'Haul away old toilet and clean work area.',triggers:['toilet replacement'],excludes:[]},
    {cat:'Core',type:'Material',name:'Wax ring or waxless seal',lo:8,hi:25,req:'always',conf:'high',reason:'Seal between toilet and flange — required for every install.',triggers:['toilet install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Closet bolts and hardware',lo:8,hi:20,req:'always',conf:'high',reason:'New bolts that secure toilet to flange.',triggers:['toilet install'],excludes:['Existing bolts in good condition']},
    {cat:'Core',type:'Material',name:'Water supply line (braided stainless)',lo:12,hi:35,req:'always',conf:'high',reason:'New supply line from shutoff to toilet tank.',triggers:['toilet install'],excludes:['Existing supply line in good condition']},
    {cat:'Often Needed',type:'Service',name:'Flange inspection and repair',lo:65,hi:195,req:'conditional',conf:'high',reason:'Check flange condition — repair or replace if corroded or cracked.',triggers:['older home','toilet was rocking'],excludes:['Flange confirmed in good condition']},
    {cat:'Often Needed',type:'Service',name:'Minor leveling or shimming',lo:25,hi:65,req:'conditional',conf:'medium',reason:'Level toilet on uneven floor.',triggers:['uneven floor'],excludes:['Floor is level']},
    {cat:'Often Needed',type:'Material',name:'Caulk for base seal',lo:5,hi:15,req:'conditional',conf:'high',reason:'Silicone caulk around toilet base per code and cleanliness.',triggers:['toilet install'],excludes:['Customer requests no caulk']},
    {cat:'Confirm',type:'Service',name:'Shutoff valve replacement',lo:95,hi:220,req:'conditional',conf:'medium',reason:'Replace seized or leaking shutoff valve while toilet is disconnected.',triggers:['old shutoff valve','valve seizes or leaks'],excludes:['Shutoff valve in good working condition']},
    {cat:'Confirm',type:'Service',name:'Flange replacement (if damaged beyond repair)',lo:145,hi:320,req:'conditional',conf:'medium',reason:'Full flange replacement when existing is broken or corroded through.',triggers:['severely damaged flange'],excludes:['Flange repairable']},
    {cat:'Upgrade',type:'Material',name:'Comfort height or elongated bowl upgrade',lo:50,hi:150,req:'optional',conf:'low',reason:'Taller toilet option for comfort — popular upgrade.',triggers:['customer interested'],excludes:[]},
    {cat:'Upgrade',type:'Material',name:'Soft-close toilet seat',lo:25,hi:65,req:'optional',conf:'low',reason:'Quality-of-life upgrade most customers appreciate.',triggers:['toilet install'],excludes:[]},
  ]
},

water_heater_install: {
  trade:'Plumbing', label:'Water Heater Install / Replacement', code:'water_heater_install',
  keywords:['water heater','hot water tank','hot water','hwt','tankless','tank replacement','water tank'],
  expected_core:5, expected_total_min:9, expected_total_max:15,
  items:[
    {cat:'Core',type:'Service',name:'Drain and remove existing water heater',lo:195,hi:380,req:'always',conf:'high',reason:'Drain, disconnect, and remove old unit.',triggers:['water heater replacement'],excludes:['New install only']},
    {cat:'Core',type:'Service',name:'Install and connect new water heater',lo:350,hi:650,req:'always',conf:'high',reason:'Set unit, connect water, gas or electric, and vent.',triggers:['water heater install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Startup, testing, and temperature set',lo:65,hi:145,req:'always',conf:'high',reason:'Light/start unit, check for leaks, set temperature, verify operation.',triggers:['water heater install'],excludes:[]},
    {cat:'Core',type:'Service',name:'Disposal and haul-away of old unit',lo:85,hi:185,req:'always',conf:'high',reason:'Remove old tank from site.',triggers:['water heater replacement'],excludes:[]},
    {cat:'Core',type:'Service',name:'Permit and inspection',lo:95,hi:250,req:'always',conf:'high',reason:'Water heater replacements typically require permit.',triggers:['water heater install'],excludes:[]},
    {cat:'Core',type:'Material',name:'Venting pipe and fittings',lo:85,hi:280,req:'always',conf:'high',reason:'Vent materials — PVC for power vent, B-vent for atmospheric.',triggers:['gas water heater'],excludes:['Electric water heater']},
    {cat:'Core',type:'Material',name:'Gas connector and shutoff valve',lo:35,hi:85,req:'conditional',conf:'high',reason:'Flexible gas connector for gas unit.',triggers:['gas water heater'],excludes:['Electric unit']},
    {cat:'Core',type:'Material',name:'Water supply connectors (flexible)',lo:25,hi:65,req:'always',conf:'high',reason:'Hot and cold water connections to new unit.',triggers:['water heater install'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'T&P valve and discharge pipe installation',lo:45,hi:120,req:'conditional',conf:'high',reason:'Safety relief valve and drain pipe — code requirement.',triggers:['water heater install'],excludes:['Existing T&P and pipe reusable']},
    {cat:'Often Needed',type:'Service',name:'Expansion tank installation',lo:120,hi:250,req:'conditional',conf:'medium',reason:'Required in closed plumbing systems to absorb thermal expansion.',triggers:['closed system','no expansion tank present'],excludes:['Open system','existing expansion tank']},
    {cat:'Often Needed',type:'Material',name:'Dielectric unions',lo:15,hi:40,req:'conditional',conf:'high',reason:'Prevent corrosion at dissimilar metal connections.',triggers:['water heater install'],excludes:['Same material throughout']},
    {cat:'Confirm',type:'Service',name:'Venting modification (if switching type)',lo:120,hi:380,req:'conditional',conf:'medium',reason:'Changing from atmospheric to power vent requires new venting.',triggers:['different vent type'],excludes:['Same vent configuration']},
    {cat:'Confirm',type:'Service',name:'Gas line upgrade or extension',lo:120,hi:350,req:'conditional',conf:'medium',reason:'Different BTU input may require larger gas line.',triggers:['different gas requirements'],excludes:['Existing gas line suitable']},
    {cat:'Confirm',type:'Service',name:'Electrical connection (power vent or electric unit)',lo:85,hi:195,req:'conditional',conf:'medium',reason:'Dedicated circuit or outlet for power vent or electric unit.',triggers:['power vent','electric unit'],excludes:['Standard atmospheric gas']},
    {cat:'Upgrade',type:'Material',name:'Expansion tank',lo:55,hi:145,req:'optional',conf:'low',reason:'Thermal expansion protection even if not strictly required.',triggers:['water heater install'],excludes:['Already installed']},
    {cat:'Upgrade',type:'Service',name:'Water heater pan and drain installation',lo:55,hi:145,req:'optional',conf:'low',reason:'Catch pan protects floors from future leaks.',triggers:['second floor or finished area install'],excludes:[]},
  ]
},

pipe_repair: {
  trade:'Plumbing', label:'Pipe Repair / Leak Repair', code:'pipe_repair',
  keywords:['pipe repair','leak','pipe leak','burst pipe','leaking pipe','pipe fix','copper repair','pipe replacement'],
  expected_core:3, expected_total_min:6, expected_total_max:11,
  items:[
    {cat:'Core',type:'Service',name:'Locate and isolate leak',lo:95,hi:195,req:'always',conf:'high',reason:'Find exact leak location and shut off water to affected area.',triggers:['pipe repair'],excludes:[]},
    {cat:'Core',type:'Service',name:'Repair or replace damaged pipe section',lo:185,hi:450,req:'always',conf:'high',reason:'Cut out failed section and install new pipe and fittings.',triggers:['pipe repair'],excludes:[]},
    {cat:'Core',type:'Service',name:'Pressure test after repair',lo:45,hi:120,req:'always',conf:'high',reason:'Verify system holds pressure with no leaks after repair.',triggers:['pipe repair'],excludes:[]},
    {cat:'Core',type:'Material',name:'Pipe and fittings (copper, PEX, or ABS/PVC)',lo:35,hi:145,req:'always',conf:'high',reason:'Replacement pipe and fittings matched to existing system.',triggers:['pipe repair'],excludes:[]},
    {cat:'Core',type:'Material',name:'Solder, fittings, or push-fit connectors',lo:15,hi:55,req:'always',conf:'high',reason:'Connection materials for the repair.',triggers:['pipe repair'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'Drywall or ceiling access cutting',lo:65,hi:195,req:'conditional',conf:'high',reason:'Cut access through finished surfaces to reach concealed pipe.',triggers:['leak behind wall or ceiling'],excludes:['Exposed or accessible pipe']},
    {cat:'Often Needed',type:'Service',name:'Water damage cleanup and drying',lo:85,hi:250,req:'conditional',conf:'medium',reason:'Initial cleanup of water damage from leak.',triggers:['active leak caused water damage'],excludes:['Leak caught immediately']},
    {cat:'Often Needed',type:'Material',name:'Shutoff valve (if existing is seized)',lo:55,hi:150,req:'conditional',conf:'medium',reason:'Replace shutoff if it fails when operated during repair.',triggers:['old shutoff valve'],excludes:['Shutoff operates correctly']},
    {cat:'Confirm',type:'Service',name:'Drywall patching and repair after access',lo:85,hi:220,req:'conditional',conf:'medium',reason:'Patch and finish drywall after access cutting.',triggers:['drywall was cut for access'],excludes:['Access area will be covered']},
    {cat:'Confirm',type:'Service',name:'Camera inspection to assess further damage',lo:150,hi:350,req:'conditional',conf:'low',reason:'Scope pipe for additional issues if leak suggests broader problem.',triggers:['suspected additional pipe damage'],excludes:['Single isolated leak']},
    {cat:'Upgrade',type:'Service',name:'Replace aging supply or drain section proactively',lo:250,hi:650,req:'optional',conf:'low',reason:'Replace old pipe section near repair to prevent future leak.',triggers:['aging pipe near repair area'],excludes:[]},
  ]
},

drain_cleaning: {
  trade:'Plumbing', label:'Drain Cleaning / Blockage', code:'drain_cleaning',
  keywords:['drain','clogged','blocked','snake','drain cleaning','backup','slow drain','blockage','auger'],
  expected_core:3, expected_total_min:5, expected_total_max:10,
  items:[
    {cat:'Core',type:'Service',name:'Drain assessment and diagnostics',lo:95,hi:175,req:'always',conf:'high',reason:'Determine blockage location and cause before clearing.',triggers:['drain service call'],excludes:[]},
    {cat:'Core',type:'Service',name:'Mechanical drain clearing (snake/auger)',lo:145,hi:350,req:'always',conf:'high',reason:'Clear blockage using cable machine or handheld auger.',triggers:['blocked drain'],excludes:[]},
    {cat:'Core',type:'Service',name:'Flow test and verification after clearing',lo:35,hi:85,req:'always',conf:'high',reason:'Run water to verify drain flows properly after clearing.',triggers:['drain clearing'],excludes:[]},
    {cat:'Often Needed',type:'Service',name:'Camera inspection of drain line',lo:150,hi:350,req:'conditional',conf:'high',reason:'Inspect drain condition to identify root cause of recurring blockage.',triggers:['recurring blockage','suspected line damage'],excludes:['One-time simple clog']},
    {cat:'Often Needed',type:'Service',name:'Cleanout access or installation',lo:120,hi:320,req:'conditional',conf:'medium',reason:'Install cleanout for future maintenance access.',triggers:['no cleanout exists'],excludes:['Cleanout already present']},
    {cat:'Often Needed',type:'Service',name:'P-trap cleaning or replacement',lo:55,hi:140,req:'conditional',conf:'medium',reason:'Remove and clean or replace clogged P-trap.',triggers:['blockage at trap'],excludes:['Blockage deeper in system']},
    {cat:'Often Needed',type:'Material',name:'Replacement P-trap or drain fittings',lo:15,hi:55,req:'conditional',conf:'medium',reason:'New trap or fittings if existing are damaged.',triggers:['damaged trap or fittings'],excludes:['Existing fittings in good condition']},
    {cat:'Confirm',type:'Service',name:'Root treatment or chemical treatment',lo:85,hi:195,req:'conditional',conf:'medium',reason:'Treat root intrusion or buildup in main drain.',triggers:['root intrusion','heavy buildup'],excludes:['Simple blockage']},
    {cat:'Confirm',type:'Service',name:'Drain line repair (if damage found)',lo:350,hi:1200,req:'conditional',conf:'low',reason:'Section repair if camera reveals pipe damage or collapse.',triggers:['camera shows damage'],excludes:['Pipe in good condition']},
    {cat:'Upgrade',type:'Service',name:'Preventive drain maintenance plan',lo:95,hi:195,req:'optional',conf:'low',reason:'Enzyme treatment or scheduled maintenance to prevent future blockage.',triggers:['recurring drain issues'],excludes:[]},
  ]
},

};

// ═══════════════════════════════════════
// CHECK SCOPE ENGINE
// ═══════════════════════════════════════

/**
 * Detect most likely job code from trade, description, and existing items
 */
export function detectJob(trade, description = '', existingItems = []) {
  if (!trade && !description) return null;
  const text = (description + ' ' + existingItems.map(i => i.name || '').join(' ')).toLowerCase();
  const tradeMap = { 'Plumber': 'Plumbing', 'Electrician': 'Electrical', 'HVAC': 'HVAC' };
  const normalTrade = tradeMap[trade] || trade;

  let bestMatch = null;
  let bestScore = 0;

  for (const [code, pattern] of Object.entries(JOB_SCOPE_PATTERNS)) {
    // Trade must match (loosely)
    const ptrade = pattern.trade;
    if (normalTrade && ptrade !== normalTrade && trade !== ptrade) continue;

    let score = 0;
    for (const kw of pattern.keywords) {
      if (text.includes(kw)) score += kw.split(' ').length; // multi-word keywords score higher
    }
    if (score > bestScore) { bestScore = score; bestMatch = code; }
  }
  return bestScore >= 1 ? bestMatch : null;
}

/**
 * Run the Check Scope engine
 * Returns structured review with 4 sections and scope score
 */
export function runScopeCheck(trade, jobCode, description = '', existingItems = []) {
  const detected = jobCode || detectJob(trade, description, existingItems);
  if (!detected || !JOB_SCOPE_PATTERNS[detected]) return null;

  const pattern = JOB_SCOPE_PATTERNS[detected];
  const existingNames = existingItems.map(i => (i.name || '').toLowerCase().trim());

  // Fuzzy match: does an existing item cover a pattern item?
  function isPresent(patternItem) {
    const pn = patternItem.name.toLowerCase();
    const words = pn.split(/\s+/).filter(w => w.length > 3);
    return existingNames.some(en => {
      if (!en) return false;
      // Exact substring match
      if (en.includes(pn.substring(0, 20)) || pn.includes(en.substring(0, 20))) return true;
      // Word overlap (3+ significant words match)
      const matchCount = words.filter(w => en.includes(w)).length;
      return matchCount >= Math.min(2, words.length);
    });
  }

  const sections = { likely_missing: [], often_included: [], confirm: [], upgrade: [] };
  let presentCore = 0;
  let totalCore = 0;

  for (const item of pattern.items) {
    const present = isPresent(item);

    if (item.cat === 'Core') {
      totalCore++;
      if (present) { presentCore++; continue; }
      sections.likely_missing.push(item);
    } else if (item.cat === 'Often Needed') {
      if (present) continue;
      sections.often_included.push(item);
    } else if (item.cat === 'Confirm') {
      if (present) continue;
      sections.confirm.push(item);
    } else if (item.cat === 'Upgrade') {
      if (present) continue;
      sections.upgrade.push(item);
    }
  }

  // Calculate scope score
  const presentTotal = existingItems.filter(i => (i.name || '').trim() && i.included !== false).length;
  const coreCoverage = totalCore > 0 ? (presentCore / totalCore) : 1;
  const coreScore = Math.round(coreCoverage * 60);
  const depthScore = presentTotal >= pattern.expected_total_min ? 25
    : presentTotal >= pattern.expected_total_min * 0.7 ? 15
    : 5;
  const missingPenalty = Math.min(10, sections.likely_missing.filter(i => i.conf === 'high').length * 3);
  const confirmPenalty = Math.min(5, sections.confirm.length);
  const score = Math.max(0, Math.min(100, coreScore + depthScore - missingPenalty - confirmPenalty));

  const status = score >= 85 ? 'strong' : score >= 70 ? 'looks_good' : score >= 50 ? 'needs_review' : 'likely_under_scoped';

  const totalMissing = sections.likely_missing.length + sections.often_included.length;
  const message = totalMissing === 0 ? 'This quote looks complete for this job.'
    : totalMissing <= 2 ? `Worth reviewing ${totalMissing} item${totalMissing > 1 ? 's' : ''} before sending.`
    : `You may be missing ${totalMissing} common items for this job.`;

  return {
    job_code: detected,
    job_label: pattern.label,
    scope_status: status,
    scope_score: score,
    summary: {
      present_core: presentCore,
      expected_core: totalCore,
      present_total: presentTotal,
      expected_range: [pattern.expected_total_min, pattern.expected_total_max],
      message,
    },
    sections: [
      { type: 'likely_missing', title: 'Likely Missing', items: sections.likely_missing },
      { type: 'often_included', title: 'Often Included', items: sections.often_included },
      { type: 'confirm', title: 'Confirm Before Sending', items: sections.confirm },
      { type: 'upgrade', title: 'Upgrade Opportunities', items: sections.upgrade },
    ].filter(s => s.items.length > 0),
  };
}
