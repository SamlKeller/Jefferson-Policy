import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const lectureSchema = new Schema({
    date: {
        type: Date,
        required: true
    },
    datePosted: {
        type: Date,
        required: false,
        default: "/defaultPic.svg"
    },
    poster: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    isProtected: {
        type: Boolean,
        required: true
    }
});

export default mongoose.models.Lecture || mongoose.model('Lecture', lectureSchema);