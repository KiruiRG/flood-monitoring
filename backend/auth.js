const jwt = require('jsonwebtoken');
exports.auth = (req,res,next) => {
 const h=req.headers.authorization||'', token=h.startsWith('Bearer ')?h.slice(7):null;
 if(!token) return res.status(401).json({error:'Authentication required'});
 try { req.user=jwt.verify(token,process.env.JWT_SECRET); next(); }
 catch { return res.status(401).json({error:'Invalid or expired token'}); }
};
exports.county = (req,res,next) => ['county_officer','admin'].includes(req.user?.role)
 ? next() : res.status(403).json({error:'County officer access required'});
