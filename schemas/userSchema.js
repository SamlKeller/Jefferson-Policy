import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    profilePic: {
        type: String,
        required: false,
        default: "/defaultPic.svg"
    },
    registerTime: {
        type: Date,
        required: true
    },
    lastLogin: {
        type: Date,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    settings: {
        type: Object,
        required: true,
    },
    fees: {
        type: Array,
        required: true
    },
    tournaments: {
        type: Array,
        required: true,
        default: []
    },
    role: {
        type: Object,
        required: true,
        default: {
            type: 'novice',
            grade: 9,
            officer: false,
            defaultPartner: ''
        }
    },
    isIonAuth: {
        type: Boolean,
        default: false
    },
});

userSchema.index({ 
    username: 'text', 
    name: 'text' 
});

export default mongoose.models.User || mongoose.model('User', userSchema);