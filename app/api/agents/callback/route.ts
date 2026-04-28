import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * POST /api/agents/callback
 * Recibir resultado de tarea desde agentes
 *
 * Requiere: Header x-agent-signature (HMAC-SHA256)
 * Payload: { task_id, status, result, error_message? }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar firma HMAC
    const signature = request.headers.get('x-agent-signature');
    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'Missing x-agent-signature header' },
        { status: 401 }
      );
    }

    const body = await request.text();
    const secret = process.env.AGENT_CALLBACK_SECRET || 'dev-secret-key';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // 2. Parse payload
    const payload = JSON.parse(body);
    const { task_id, status, result, error_message } = payload;

    if (!task_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: task_id, status' },
        { status: 400 }
      );
    }

    // 3. Update task
    const adminClient = createAdminClient();
    const { data: task, error: updateError } = await (adminClient
      .from('agent_tasks')
      .update({
        status,
        result: result || null,
        error_message: error_message || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task_id)
      .select() as any);

    if (updateError) {
      console.error('Error updating agent task:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update task' },
        { status: 500 }
      );
    }

    // 4. Create audit log entry
    await (adminClient
      .from('agent_task_logs')
      .insert({
        task_id,
        action: 'callback_received',
        details: { status, result, error_message },
        created_at: new Date().toISOString(),
      }) as any);

    return NextResponse.json(
      {
        success: true,
        message: `Task ${task_id} updated to ${status}`,
        task_id,
        status,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('POST /api/agents/callback error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
