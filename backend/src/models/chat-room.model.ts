import mongoose, { Schema, Document } from 'mongoose';

export interface IChatRoom extends Document {
    name: string;
    participants: mongoose.Types.ObjectId[];
    lastMessage?: mongoose.Types.ObjectId;
    isGroup: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const chatRoomSchema = new Schema<IChatRoom>({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
    },
    isGroup: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Index for faster queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ lastMessage: -1 });

export default mongoose.model<IChatRoom>('ChatRoom', chatRoomSchema); 