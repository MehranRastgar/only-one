import mongoose, { Schema, Document } from 'mongoose';

export interface IPartnership extends Document {
    users: mongoose.Types.ObjectId[];
    chatRoom?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const partnershipSchema = new Schema<IPartnership>({
    users: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    chatRoom: {
        type: Schema.Types.ObjectId,
        ref: 'ChatRoom'
    }
}, {
    timestamps: true
});

// Ensure exactly 2 users in a partnership
partnershipSchema.pre('save', function (next) {
    if (this.users.length !== 2) {
        next(new Error('A partnership must have exactly 2 users'));
    } else {
        next();
    }
});

// Index for faster queries
partnershipSchema.index({ users: 1 });

export default mongoose.model<IPartnership>('Partnership', partnershipSchema); 