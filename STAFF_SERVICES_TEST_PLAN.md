# Staff ↔ Services Relation System - Test Plan

## Overview
This test plan verifies the complete Staff ↔ Services relation system after implementing JWT-based RLS, canonical table structure, and bidirectional UI sync.

## Test Environment Setup
1. Run migration `0111_staff_services_rls_complete_fix.sql`
2. Ensure users have proper JWT claims with tenant_id
3. Have test data: tenants, memberships, staff, services

## Test Cases

### 1. RLS Security Tests

#### 1.1 JWT-based Access Control
**Objective**: Verify RLS policies work with JWT tenant_id claims

**Steps**:
1. Authenticate user with valid tenant membership
2. Query staff table: `SELECT * FROM staff WHERE tenant_id = 'test-tenant-id'`
3. Verify query returns only records for user's tenant
4. Try querying different tenant_id: should return empty
5. Check JWT claims: `SELECT auth.get_jwt_claims()`

**Expected Results**:
- ✅ Query returns tenant-specific data
- ✅ Cross-tenant queries blocked
- ✅ JWT contains correct tenant_id

#### 1.2 Invalid JWT Handling
**Objective**: Ensure system handles missing/invalid JWT gracefully

**Steps**:
1. Try queries without authentication
2. Use malformed JWT
3. Check error responses

**Expected Results**:
- ✅ Queries fail safely without data leakage
- ✅ No crashes or infinite loops

### 2. Staff ↔ Services Relation Tests

#### 2.1 Canonical Table Structure
**Objective**: Verify staff_provides_services table is properly structured

**Steps**:
1. Check table schema: `\d staff_provides_services`
2. Verify constraints: unique(tenant_id, staff_id, service_id)
3. Check indexes exist
4. Verify RLS is enabled
5. Test foreign key relationships

**Expected Results**:
- ✅ Table has correct columns and constraints
- ✅ Indexes created
- ✅ RLS policies active
- ✅ References work correctly

#### 2.2 Data Migration
**Objective**: Verify backfill from services.staff_only_ids works

**Steps**:
1. Create services with staff_only_ids arrays
2. Run migration backfill
3. Check relations created in staff_provides_services
4. Verify sync_staff_only_ids_from_relations() works

**Expected Results**:
- ✅ Relations created from legacy data
- ✅ No duplicates
- ✅ Legacy field synced correctly

### 3. UI Integration Tests

#### 3.1 Staff Detail Page
**Objective**: Test bidirectional sync from Staff modal

**Steps**:
1. Open Staff Edit modal for existing staff
2. Load current services assignments
3. Add/remove service assignments
4. Save changes
5. Verify relations in staff_provides_services table
6. Check legacy staff_only_ids field synced

**Expected Results**:
- ✅ Services load from relations table
- ✅ Changes save to relations table
- ✅ Legacy field updated
- ✅ UI reflects changes immediately

#### 3.2 Services Modal
**Objective**: Test bidirectional sync from Services modal

**Steps**:
1. Open Service creation/editing modal
2. Load current staff assignments (from relations)
3. Add/remove staff assignments
4. Save service
5. Verify relations in staff_provides_services table
6. Check legacy staff_only_ids field synced

**Expected Results**:
- ✅ Staff assignments load from relations table
- ✅ Changes save to relations table
- ✅ Legacy field updated
- ✅ UI reflects changes

#### 3.3 Bidirectional Consistency
**Objective**: Ensure changes in one UI reflect in the other

**Steps**:
1. Assign staff to service via Services modal
2. Check assignment appears in Staff modal
3. Remove assignment via Staff modal
4. Verify removal in Services modal

**Expected Results**:
- ✅ Changes sync bidirectionally
- ✅ No data inconsistencies

### 4. Business Logic Tests

#### 4.1 Staff Active/Inactive Handling
**Objective**: Verify inactive staff appear in configuration but not in availability

**Steps**:
1. Create inactive staff member
2. Assign to services
3. Check appears in Services modal staff list
4. Run availability query: should not include inactive staff
5. Check booking system respects active flag

**Expected Results**:
- ✅ Inactive staff in configuration UIs
- ✅ Inactive staff excluded from availability
- ✅ Bookings respect active status

#### 4.2 Availability Function
**Objective**: Verify get_available_slots uses relations correctly

**Steps**:
1. Set up staff schedules and services
2. Assign staff to services via relations table
3. Run get_available_slots function
4. Verify correct slots returned
5. Test with staff_only_ids restrictions

**Expected Results**:
- ✅ Function uses relations table
- ✅ Legacy field compatibility maintained
- ✅ Correct availability calculation

### 5. Helper Functions Tests

#### 5.1 Unified Tenant Helpers
**Objective**: Test fetchTenantStaff and fetchTenantServices

**Steps**:
1. Call fetchTenantStaff(tenantId)
2. Verify returns correct staff list
3. Call fetchTenantServices(tenantId)
4. Verify returns correct services list
5. Test error handling with invalid tenantId
6. Test with missing session

**Expected Results**:
- ✅ Functions return correct data
- ✅ Proper error handling
- ✅ Session validation works

#### 5.2 Relation Management
**Objective**: Test updateStaffServices and updateServiceStaff

**Steps**:
1. Test updateStaffServices with additions/removals
2. Verify relations table updated
3. Check legacy field synced
4. Test updateServiceStaff
5. Verify bidirectional sync

**Expected Results**:
- ✅ Relations updated correctly
- ✅ Legacy field synchronized
- ✅ No orphaned records

### 6. Performance Tests

#### 6.1 Query Performance
**Objective**: Ensure queries perform well with RLS

**Steps**:
1. Create large dataset (100+ staff, services, relations)
2. Run typical queries with EXPLAIN ANALYZE
3. Check index usage
4. Test with multiple tenants

**Expected Results**:
- ✅ Queries use indexes
- ✅ Response times acceptable (<500ms)
- ✅ No full table scans

#### 6.2 Concurrent Access
**Objective**: Test concurrent updates don't cause issues

**Steps**:
1. Simulate multiple users updating relations
2. Check for race conditions
3. Verify data consistency

**Expected Results**:
- ✅ No data corruption
- ✅ Proper locking/serialization

### 7. Edge Cases & Error Handling

#### 7.1 Missing Tenant
**Objective**: Handle cases where tenant resolution fails

**Steps**:
1. Test with undefined tenantId
2. Test with non-existent tenant
3. Test with user without membership

**Expected Results**:
- ✅ Graceful error handling
- ✅ No crashes
- ✅ Appropriate error messages

#### 7.2 Invalid Relations
**Objective**: Handle attempts to create invalid relations

**Steps**:
1. Try creating relation with wrong tenant
2. Try duplicate relations
3. Try relations with deleted staff/services

**Expected Results**:
- ✅ RLS blocks invalid operations
- ✅ Constraints prevent duplicates
- ✅ Foreign keys maintained

### 8. Regression Tests

#### 8.1 Existing Functionality
**Objective**: Ensure no existing features broken

**Steps**:
1. Test booking creation
2. Test availability queries
3. Test staff/service CRUD operations
4. Test existing UI flows

**Expected Results**:
- ✅ All existing functionality works
- ✅ No regressions introduced

## Success Criteria

### Functional Requirements
- [ ] RLS blocks cross-tenant access
- [ ] Staff ↔ Services relations work bidirectionally
- [ ] UI updates sync to canonical table
- [ ] Legacy compatibility maintained
- [ ] Inactive staff handled correctly

### Performance Requirements
- [ ] All queries <500ms
- [ ] No full table scans
- [ ] Proper index usage

### Security Requirements
- [ ] No data leakage between tenants
- [ ] JWT validation works
- [ ] Invalid operations blocked

### Reliability Requirements
- [ ] Error handling graceful
- [ ] Concurrent access safe
- [ ] Data consistency maintained

## Test Execution Checklist

### Pre-Deployment
- [ ] Migration runs successfully
- [ ] No data loss during migration
- [ ] JWT claims updated for existing users

### Post-Deployment
- [ ] All UI flows work
- [ ] RLS policies active
- [ ] Helper functions work
- [ ] Performance acceptable

### Production Monitoring
- [ ] Error rates acceptable
- [ ] Query performance monitored
- [ ] User feedback collected
