const mongoose = require('mongoose');

const StudentLoginSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        trim:true,
        minlength:2,
        maxlength:80,
        unique:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        maxlength:254
    },
    password:{
        type:String,
        required:true,
        select:false
    },
    role:{
        type:String,
        enum:['Student','Warden','SecurityGuard','Admin','Teacher'],
        default:'Student'
    },
    tokenVersion:{type:Number, default:0, select:false},
    rollNumber:{type:String, trim:true, maxlength:40, default:''},
    course:{type:String, trim:true, maxlength:100, default:''},
    year:{type:String, trim:true, maxlength:30, default:''},
    hostel:{type:String, trim:true, maxlength:100, default:''},
    room:{type:String, trim:true, maxlength:30, default:''},
    phone:{type:String, trim:true, maxlength:20, default:''}
}, {
    timestamps:true,
    toJSON:{
        transform(_document, result) {
            delete result.password;
            delete result.__v;
            delete result.tokenVersion;
            return result;
        }
    }
});

const studentLoginModel = mongoose.model('studentLoginModel',StudentLoginSchema);

module.exports = studentLoginModel;