export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendTicketEmail } from '@/lib/sendTicketEmail';

export async function POST(req: NextRequest) {
  try {
    const { userId, fullName, phone, avatarUrl, email } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 1. Fetch current profile data
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, email_unlocked, full_name, role')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    let emailChanged = false;
    const finalEmail = email ? email.trim() : '';

    // Check if email is being updated
    if (finalEmail && finalEmail !== profile.email) {
      // Rule: cannot update if locked (unless user is admin)
      if (!profile.email_unlocked && profile.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak. Pengeditan alamat email terkunci.' }, { status: 403 });
      }

      // Rule: email must not be empty
      if (!finalEmail) {
        return NextResponse.json({ error: 'Alamat email tidak boleh kosong.' }, { status: 400 });
      }

      // Rule: email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        return NextResponse.json({ error: 'Format email tidak valid. Harap gunakan format email yang benar.' }, { status: 400 });
      }

      // Rule: must not be in use by another user
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', finalEmail)
        .neq('user_id', userId)
        .maybeSingle();

      if (existingProfile) {
        return NextResponse.json({ error: 'Email tersebut sudah digunakan. Silakan gunakan alamat email lain.' }, { status: 400 });
      }

      // Update Supabase Auth Email directly without confirmation link bypass (service role role key)
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: finalEmail });
      if (authError) throw authError;

      emailChanged = true;
    }

    // Update profiles table
    const updateFields: any = {
      full_name: fullName,
      phone: phone,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    };

    if (emailChanged) {
      updateFields.email = finalEmail;
      updateFields.email_unlocked = false; // relock field
    }

    // Lock role as admin if the current profile is admin to guarantee role preservation
    if (profile.role === 'admin') {
      updateFields.role = 'admin';
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update(updateFields)
      .eq('user_id', userId);

    if (updateErr) throw updateErr;

    // Handle post email change status updates, audit logs and notifications
    if (emailChanged) {
      // Find the approved 'perubahan email' ticket for this customer
      const { data: approvedTicket } = await supabaseAdmin
        .from('support_tickets')
        .select('*')
        .eq('customer_id', profile.id)
        .eq('category', 'perubahan email')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const delayMs = 30 * 60 * 1000; // 30 minutes
      const chatClosedAt = new Date().toISOString();
      const chatHistoryDeletedAt = new Date(Date.now() + delayMs).toISOString();

      if (approvedTicket) {
        // Complete the approved ticket
        await supabaseAdmin
          .from('support_tickets')
          .update({
            status: 'completed',
            chat_closed_at: chatClosedAt,
            chat_history_deleted_at: chatHistoryDeletedAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', approvedTicket.id);

        // Insert system message in chat
        await supabaseAdmin.from('ticket_messages').insert({
          ticket_id: approvedTicket.id,
          message: `[SISTEM] Pelanggan berhasil memperbarui email dari ${profile.email} menjadi ${finalEmail}. Kolom email dikunci kembali.`
        });
      }

      // Write into profile_audit_logs
      await supabaseAdmin.from('profile_audit_logs').insert({
        ticket_id: approvedTicket ? approvedTicket.id : null,
        ticket_number: approvedTicket ? approvedTicket.ticket_number : null,
        category: approvedTicket ? approvedTicket.category : 'perubahan email',
        customer_id: profile.id,
        changed_by: profile.id,
        approved_by: approvedTicket ? approvedTicket.assigned_to : null,
        approved_at: approvedTicket ? approvedTicket.updated_at : null,
        changed_at: new Date().toISOString(),
        old_email: profile.email || '',
        new_email: finalEmail,
        status_before: 'approved',
        status_after: 'completed',
        reason: 'Perubahan email berhasil disimpan oleh pelanggan'
      });

      // Send realtime notification in notifications table
      await supabaseAdmin.from('notifications').insert({
        user_id: profile.id,
        title: 'Data Akun Diperbarui',
        message: 'Data akun Anda telah berhasil diperbarui dan disimpan. Terima kasih.',
        type: 'support_status',
        reference_id: approvedTicket ? approvedTicket.id : null,
        status_badge: 'Selesai'
      });

      // Send email to new email address
      await sendTicketEmail({
        email: finalEmail,
        name: fullName || profile.full_name || 'Pelanggan',
        ticketNumber: approvedTicket ? approvedTicket.ticket_number : 'TKT-UPDATE',
        category: approvedTicket ? approvedTicket.category : 'perubahan email',
        title: approvedTicket ? approvedTicket.title : 'Perubahan Alamat Email',
        status: 'completed',
        oldEmail: profile.email,
        newEmail: finalEmail
      }).catch(err => console.error('[sendTicketEmail] Error sending success email:', err));
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Profil berhasil diperbarui',
      data: { fullName, phone, avatarUrl, email: emailChanged ? finalEmail : profile.email }
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
