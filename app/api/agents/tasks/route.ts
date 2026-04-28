import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/agents/tasks
 * Crear nueva tarea para agentes
 *
 * Requiere: Authorization: Bearer sk_agent_dev
 * Payload: { type, tenant_id, payload, priority?, assigned_agent? }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const expectedKey = process.env.AGENT_API_KEY || 'sk_agent_dev';
    if (apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 403 }
      );
    }

    // 2. Parse request
    const body = await request.json();
    const { type, tenant_id, payload, priority = 'normal', assigned_agent } = body;

    // 3. Validate required fields
    if (!type || !tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, tenant_id' },
        { status: 400 }
      );
    }

    // 4. Verify tenant exists
    const adminClient = createAdminClient();
    const { data: tenant, error: tenantError } = await (adminClient
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single() as any);

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: `Tenant not found: ${tenant_id}` },
        { status: 404 }
      );
    }

    // 5. Create agent task
    const taskId = uuidv4();
    const { data: task, error: taskError } = await (adminClient
      .from('agent_tasks')
      .insert([
        {
          id: taskId,
          type,
          department: getDepartmentByType(type),
          tenant_id,
          assigned_agent,
          status: 'pendiente',
          priority,
          payload: payload || {},
          openclaw_session_key: 'agent:main:main',
        },
      ])
      .select() as any);

    if (taskError) {
      console.error('Error creating agent task:', taskError);
      return NextResponse.json(
        { success: false, error: 'Failed to create task', details: taskError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        task: {
          id: taskId,
          type,
          status: 'pendiente',
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/agents/tasks error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getDepartmentByType(type: string): string {
  const map: Record<string, string> = {
    onboarding: 'ingenieria',
    bug: 'ingenieria',
    soporte: 'soporte',
    email: 'soporte',
    whatsapp: 'soporte',
    contenido: 'marketing',
    social: 'marketing',
    prospección: 'ventas',
    billing: 'operaciones',
  };
  return map[type] || 'ingenieria';
}
