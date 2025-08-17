import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const lectureSchema = new Schema({
    name: {
        type: Date,
        required: true
    },
    datePosted: {
        type: Date,
        required: true,
        default: Date.now
    },
    tournaments: {
        type: Array,
        required: true
    },
    contactInfo: {
        type: Object,
        required: true
    },
    notes: {
        type: String,
        required: true
    }
});

export default mongoose.models.Lecture || mongoose.model('Lecture', lectureSchema);