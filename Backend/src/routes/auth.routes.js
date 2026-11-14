const express=require("express");
const authLogin=require("../controller/login.users");
const { requireAuth } = require('../middleware/auth');
const User = require('../models/StudentLogin');

const router=express.Router();

router.post('/register', authLogin.RegisterUser);
router.post('/login', authLogin.LoginUser);
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
router.post('/logout', requireAuth, async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    return res.json({ message: 'Signed out.' });
});

module.exports=router