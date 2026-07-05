import { Schema, model, type Document } from 'mongoose';

export interface ISupportTicket extends Document {
	userId: string;
	subject: string;
	message: string;
	status: 'open' | 'in_progress' | 'closed';
	adminReply?: string;
}

const supportTicketSchema = new Schema<ISupportTicket>(
	{
		userId: { type: String, required: true, trim: true, index: true },
		subject: { type: String, required: true, trim: true, maxlength: 150 },
		message: { type: String, required: true, trim: true, maxlength: 3000 },
		status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
		adminReply: { type: String, trim: true, maxlength: 2000, default: '' },
	},
	{ timestamps: true, versionKey: false },
);

export const SupportTicket = model<ISupportTicket>('SupportTicket', supportTicketSchema);
