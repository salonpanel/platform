import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/agents/tasks
 * Listar tareas con filtros
 *
 * Requiere: Session autenticada + rol platform_admin
 * Parámetros: status, type, tenant_id, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    // 1. TODO: Verificar autenticación y rol platform_admin
    // Por ahora, permitir acceso (será protegido después)

    // 2. Extract query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const tenantId = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. Build query
    const adminClient = createAdminClient();
    let query = adminClient.from('agent_tasks').select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    // 4. Apply pagination and sorting
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: tasks, error: queryError, count } = await (query as any);

    if (queryError) {
      console.error('Error fetching agent tasks:', queryError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    // 5. Return paginated results
    return NextResponse.json(
      {
        success: true,
        tasks: tasks || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: offset + limit < (count || 0),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('GET /api/admin/agents/tasks error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
