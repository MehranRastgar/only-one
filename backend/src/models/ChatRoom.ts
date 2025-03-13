import mongoose, { Document, Schema } from 'mongoose';

export interface IChatRoom extends Document {
    name: string;
    participants: mongoose.Types.ObjectId[];
    isGroup: boolean;
    lastMessage?: mongoose.Types.ObjectId;
    admins?: mongoose.Types.ObjectId[];
}

const chatRoomSchema = new Schema<IChatRoom>({
    name: {
        type: String,
        required: function (this: IChatRoom) {
            return this.isGroup;
        },
        trim: true,
    },
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    isGroup: {
        type: Boolean,
        default: false,
    },
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
    },
    admins: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
}, {
    timestamps: true,
});

// Index for faster queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ lastMessage: -1 });

export const ChatRoom = mongoose.model<IChatRoom>('ChatRoom', chatRoomSchema); 