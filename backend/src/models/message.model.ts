import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    content: string;
    type: 'text' | 'gif' | 'image';
    imageUrl?: string;
    sender: mongoose.Types.ObjectId;
    chatRoom: mongoose.Types.ObjectId;
    readBy: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
    content: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['text', 'gif', 'image'],
        default: 'text',
    },
    imageUrl: {
        type: String,
        required: function (this: IMessage) {
            return this.type === 'image';
        }
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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
}, {
    timestamps: true,
});

// Indexes for faster queries
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ readBy: 1 });

export default mongoose.model<IMessage>('Message', messageSchema); 