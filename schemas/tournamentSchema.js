import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const tournamentSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    datePosted: {
        type: Date,
        required: true,
        default: Date.now
    },
    description: {
        type: String,
        required: false,
        default: ""
    },
    requirements: {
        type: String,
        required: true
    },
    signups: {
        type: [],
        required: true
    },
    judges: {
        type: [],
        required: true
    },
    maxParticipants: {
        type: Number,
        required: false
    },
    type: {
        type: String,
        required: true,
        default: 'Local'
    }
});

tournamentSchema.index({ 
    username: 'text', 
    name: 'text' 
});

export default mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);