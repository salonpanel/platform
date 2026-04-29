import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * PATCH /api/admin/agents/tasks/{id}
 * Aprobar, rechazar, reintentar o reasignar tareas
 *
 * Requiere: Session autenticada + rol platform_admin
 * Payload: { action, reason?, notes?, assigned_agent? }
 * Actions: approve, reject, retry, reassign
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. TODO: Verificar autenticación y rol platform_admin
    const taskId = params.id;

    // 2. Parse payload
    const body = await request.json();
    const { action, reason, notes, assigned_agent } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const validActions = ['approve', 'reject', 'retry', 'reassign'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Get current task
    const adminClient = getSupabaseAdmin();
    const { data: task, error: fetchError } = await (adminClient
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single() as any);

    if (fetchError || !task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    // 4. Perform action
    let updateData: any = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'approve':
        updateData.status = 'aprobado';
        updateData.approved_by = 'admin'; // TODO: Get from session
        updateData.approved_at = new Date().toISOString();
        updateData.approval_notes = notes;
        break;

      case 'reject':
        updateData.status = 'rechazado';
        updateData.approved_by = 'admin';
        updateData.approved_at = new Date().toISOString();
        updateData.approval_notes = notes;
        break;

      case 'retry':
        updateData.status = 'pendiente';
        updateData.retries = (task.retries || 0) + 1;
        if (updateData.retries > task.max_retries) {
          return NextResponse.json(
            {
              success: false,
              error: `Maximum retries (${task.max_retries}) exceeded`,
            },
            { status: 400 }
          );
        }
        break;

      case 'reassign':
        if (!assigned_agent) {
          return NextResponse.json(
            { success: false, error: 'assigned_agent required for reassign action' },
            { status: 400 }
          );
        }
        updateData.assigned_agent = assigned_agent;
        updateData.status = 'pendiente';
        break;
    }

    // 5. Update task
    const { data: updatedTask, error: updateError } = await (adminClient
      .from('agent_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select() as any);

    if (updateError) {
      console.error('Error updating agent task:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update task' },
        { status: 500 }
      );
    }

    // 6. Create audit log
    await (adminClient
      .from('agent_task_logs')
      .insert({
        task_id: taskId,
        action: `admin_${action}`,
        details: { reason, notes, assigned_agent },
        created_at: new Date().toISOString(),
      }) as any);

    return NextResponse.json(
      {
        success: true,
        message: `Task ${action}ed successfully`,
        task_id: taskId,
        new_status: updateData.status,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('PATCH /api/admin/agents/tasks/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
