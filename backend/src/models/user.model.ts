import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen: Date;
    chatRooms: mongoose.Types.ObjectId[];
    partnerCode?: string | null;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generatePartnerCode(): string;
}

const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    avatar: {
        type: String,
        default: '',
    },
    isOnline: {
        type: Boolean,
        default: false,
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },
    chatRooms: [{
        type: Schema.Types.ObjectId,
        ref: 'ChatRoom',
    }],
    partnerCode: {
        type: String,
        unique: true,
        sparse: true,
        default: null,
    }
}, {
    timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Generate partner code method
userSchema.methods.generatePartnerCode = function (): string {
    // Generate a random 8-character code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.partnerCode = code;
    return code;
};

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ partnerCode: 1 });

export default mongoose.model<IUser>('User', userSchema); 