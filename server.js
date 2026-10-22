require('dotenv').config();
const express=require('express'), cors=require('cors'), helmet=require('helmet'), bcrypt=require('bcryptjs'), jwt=require('jsonwebtoken');
const path=require('path'), db=require('./db'), {auth,county}=require('./auth');
const app=express();
app.use(helmet({contentSecurityPolicy:false})); app.use(cors()); app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'../public')));
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);

async function initDemoUsers(){
 for(const u of [
  ['County Demo Officer','county.demo@example.test','ChangeMe123!','county_officer'],
  ['Citizen Demo User','citizen.demo@example.test','ChangeMe123!','citizen']]){
  const [rows]=await db.execute('SELECT id FROM users WHERE email=?',[u[1]]);
  if(!rows.length) await db.execute('INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',[u[0],u[1],await bcrypt.hash(u[2],12),u[3]]);
 }
}
app.get('/api/health',wrap(async(req,res)=>{await db.query('SELECT 1');res.json({status:'ok',database:'connected'});}));
app.post('/api/auth/login',wrap(async(req,res)=>{
 const {email,password}=req.body||{}; if(!email||!password)return res.status(400).json({error:'Email and password required'});
 const [rows]=await db.execute('SELECT * FROM users WHERE email=?',[String(email).trim().toLowerCase()]);
 if(!rows.length||!await bcrypt.compare(password,rows[0].password_hash))return res.status(401).json({error:'Invalid email or password'});
 const u=rows[0], token=jwt.sign({id:u.id,name:u.full_name,email:u.email,role:u.role},process.env.JWT_SECRET,{expiresIn:'8h'});
 res.json({token,user:{id:u.id,name:u.full_name,email:u.email,role:u.role}});
}));
app.get('/api/predictions',wrap(async(req,res)=>{const [data]=await db.query('SELECT * FROM predictions ORDER BY forecast_for DESC LIMIT 50');res.json({data});}));
app.get('/api/alerts',wrap(async(req,res)=>{const [data]=await db.query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100');res.json({data});}));
app.get('/api/incidents',auth,wrap(async(req,res)=>{
 let sql='SELECT i.*,u.full_name AS reporter_name FROM incident_reports i LEFT JOIN users u ON i.reporter_id=u.id',args=[];
 if(req.user.role==='citizen'){sql+=' WHERE i.reporter_id=?';args.push(req.user.id);}
 sql+=' ORDER BY i.created_at DESC LIMIT 200';const [data]=await db.execute(sql,args);res.json({data});
}));
app.post('/api/incidents',auth,wrap(async(req,res)=>{
 const {incident_type='flooding',description,location_name,latitude,longitude,contact_phone}=req.body||{};
 const types=['flooding','rescue_request','evacuation_help','property_damage','other'];
 if(!types.includes(incident_type)||!description?.trim()||!location_name?.trim())return res.status(400).json({error:'Valid incident type, description and location required'});
 const lat=latitude===''||latitude==null?null:Number(latitude),lon=longitude===''||longitude==null?null:Number(longitude);
 if((lat!==null&&(!Number.isFinite(lat)||lat < -90||lat>90))||(lon!==null&&(!Number.isFinite(lon)||lon < -180||lon>180)))return res.status(400).json({error:'Invalid coordinates'});
 const [r]=await db.execute('INSERT INTO incident_reports(reporter_id,incident_type,description,location_name,latitude,longitude,contact_phone) VALUES(?,?,?,?,?,?,?)',[req.user.id,incident_type,description.trim(),location_name.trim(),lat,lon,contact_phone||null]);
 res.status(201).json({message:'Incident submitted',id:r.insertId});
}));
app.patch('/api/incidents/:id/status',auth,county,wrap(async(req,res)=>{
 const statuses=['SUBMITTED','UNDER_REVIEW','RESPONDER_CONTACTED','RESOLVED','REJECTED'];
 if(!statuses.includes(req.body?.status))return res.status(400).json({error:'Invalid status'});
 const [r]=await db.execute('UPDATE incident_reports SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?',[req.body.status,req.user.id,req.params.id]);
 if(!r.affectedRows)return res.status(404).json({error:'Incident not found'});res.json({message:'Status updated'});
}));
app.get('/api/coordination',auth,county,wrap(async(req,res)=>{const [data]=await db.query('SELECT * FROM coordination_records ORDER BY created_at DESC LIMIT 100');res.json({data});}));
app.post('/api/coordination',auth,county,wrap(async(req,res)=>{
 const {incident_id,agency_name,action_note,status='PLANNED'}=req.body||{};
 if(!agency_name?.trim()||!action_note?.trim()||!['PLANNED','CONTACTED','STANDBY','COMPLETED'].includes(status))return res.status(400).json({error:'Agency, note and valid status required'});
 const [r]=await db.execute('INSERT INTO coordination_records(incident_id,created_by,agency_name,action_note,status) VALUES(?,?,?,?,?)',[incident_id||null,req.user.id,agency_name.trim(),action_note.trim(),status]);
 res.status(201).json({id:r.insertId,message:'Coordination record created'});
}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Server error; check backend logs'});});
const port=Number(process.env.PORT||3000);
if(!process.env.JWT_SECRET||process.env.JWT_SECRET.includes('replace-with'))console.warn('Set JWT_SECRET in .env before use.');
initDemoUsers().then(()=>app.listen(port,()=>console.log(`API: http://localhost:${port}`))).catch(e=>{console.error('Database startup failed:',e.message);process.exit(1);});
