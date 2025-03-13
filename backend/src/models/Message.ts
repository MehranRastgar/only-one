import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    sender: mongoose.Types.ObjectId;
    content: string;
    chatRoom: mongoose.Types.ObjectId;
    readBy: mongoose.Types.ObjectId[];
    attachments?: string[];
}

const messageSchema = new Schema<IMessage>({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    chatRoom: {
        type: Schema.Types.ObjectId,
        ref: 'ChatRoom',
        required: true,
    },
    readBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
    attachments: [{
        type: String,
    }],
}, {
    timestamps: true,
});

export const Message = mongoose.model<IMessage>('Message', messageSchema); 