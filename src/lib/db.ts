import { getSupabaseAdmin } from "./supabase/admin";
import { randomUUID } from "node:crypto";

function parseDates(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map(parseDates);
  }
  if (typeof val === "object") {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (
        (k === "createdAt" ||
          k === "updatedAt" ||
          k === "deletedAt" ||
          k === "publishedAt" ||
          k === "submittedAt" ||
          k === "lastContactedAt" ||
          k === "nextActionAt" ||
          k === "lastLoginAt" ||
          k === "lastReviewedAt" ||
          k === "startedAt" ||
          k === "endedAt" ||
          k === "dueDate" ||
          k === "completedAt" ||
          k === "rescheduledAt" ||
          k === "expectedCloseDate" ||
          k === "pilotStartDate" ||
          k === "pilotEndDate" ||
          k === "timestamp" ||
          k === "changedAt") &&
        typeof v === "string"
      ) {
        res[k] = new Date(v);
      } else {
        res[k] = parseDates(v);
      }
    }
    return res;
  }
  return val;
}

function queryValue(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(queryValue);
  return value;
}

class ModelAdapter<T> {
  constructor(private tableName: string) {}

  async findMany(options?: { where?: any; orderBy?: any; include?: any; select?: any; skip?: number; take?: number }) {
    const supabase: any = getSupabaseAdmin();
    let selectFields = "*";
    
    // Simple mock support for includes
    if (this.tableName === "prospect_clinics" && options?.include) {
      const includes: string[] = [];
      if (options.include.contacts) includes.push("contacts:prospect_contacts(*)");
      if (options.include.locations) includes.push("locations:prospect_locations(*)");
      if (options.include.services) includes.push("services:prospect_clinic_services(*)");
      if (includes.length > 0) selectFields = `*, ${includes.join(", ")}`;
    } else if (this.tableName === "prospect_directory_profiles" && options?.include) {
      const includes: string[] = [];
      if (options.include.clinic) includes.push("clinic:prospect_clinics(*)");
      if (includes.length > 0) selectFields = `*, ${includes.join(", ")}`;
    } else if (this.tableName === "prospect_calls" && options?.include) {
      const includes: string[] = [];
      if (options.include.clinic) includes.push("clinic:prospect_clinics(*)");
      if (includes.length > 0) selectFields = `*, ${includes.join(", ")}`;
    } else if (this.tableName === "prospect_tasks" && options?.include) {
      const includes: string[] = [];
      if (options.include.clinic) includes.push("clinic:prospect_clinics(*)");
      if (includes.length > 0) selectFields = `*, ${includes.join(", ")}`;
    }

    let query = supabase.from(this.tableName).select(selectFields);

    if (options?.where) {
      for (const [key, val] of Object.entries(options.where)) {
        if (key === "OR" && Array.isArray(val)) {
          const expressions = val.flatMap((condition: Record<string, any>) =>
            Object.entries(condition).map(([field, filter]) => {
              if (filter && typeof filter === "object" && "contains" in filter) {
                return `${field}.ilike.*${String(filter.contains).replace(/[,*()]/g, "")}*`;
              }
              return `${field}.eq.${String(filter)}`;
            })
          );
          if (expressions.length) query = query.or(expressions.join(","));
          continue;
        }
        if (val === null) {
          query = query.is(key, null);
        } else if (typeof val === "object" && val !== null) {
          if ("in" in val) {
            query = query.in(key, queryValue(val.in) as any[]);
          } else if ("notIn" in val) {
            query = query.not(key, "in", `(${(val.notIn as any[]).join(",")})`);
          } else if ("not" in val) {
            const notVal = (val as any).not;
            if (notVal === null) {
              query = query.not(key, "is", null);
            } else {
              query = query.neq(key, queryValue(notVal));
            }
          } else if ("contains" in val) {
            query = query.ilike(key, `%${val.contains}%`);
          } else if ("gte" in val) {
            query = query.gte(key, queryValue(val.gte));
          } else if ("lte" in val) {
            query = query.lte(key, queryValue(val.lte));
          } else if ("gt" in val) {
            query = query.gt(key, queryValue(val.gt));
          } else if ("lt" in val) {
            query = query.lt(key, queryValue(val.lt));
          }
        } else {
          query = query.eq(key, queryValue(val));
        }
      }
    }

    if (options?.orderBy) {
      if (Array.isArray(options.orderBy)) {
        for (const order of options.orderBy) {
          for (const [key, val] of Object.entries(order)) {
            query = query.order(key, { ascending: val === "asc" });
          }
        }
      } else {
        for (const [key, val] of Object.entries(options.orderBy)) {
          query = query.order(key, { ascending: val === "asc" });
        }
      }
    }

    if (options?.skip !== undefined && options?.take !== undefined) {
      query = query.range(options.skip, options.skip + options.take - 1);
    } else if (options?.take !== undefined) {
      query = query.limit(options.take);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error in findMany for ${this.tableName}`, error);
      throw error;
    }
    return parseDates(data) || [];
  }

  async findUnique(options: { where: any; include?: any }) {
    const supabase: any = getSupabaseAdmin();
    let selectFields = "*";
    
    if (this.tableName === "prospect_clinics" && options?.include) {
      const includes: string[] = [];
      if (options.include.contacts) includes.push("contacts:prospect_contacts(*)");
      if (options.include.locations) includes.push("locations:prospect_locations(*)");
      if (options.include.services) includes.push("services:prospect_clinic_services(*)");
      if (includes.length > 0) selectFields = `*, ${includes.join(", ")}`;
    }

    let query = supabase.from(this.tableName).select(selectFields);

    for (const [key, val] of Object.entries(options.where)) {
      query = query.eq(key, queryValue(val));
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error(`Error in findUnique for ${this.tableName}`, error);
      throw error;
    }
    return parseDates(data);
  }

  async findFirst(options?: { where: any; orderBy?: any }) {
    const supabase: any = getSupabaseAdmin();
    let query = supabase.from(this.tableName).select("*");
    
    if (options?.where) {
      for (const [key, val] of Object.entries(options.where)) {
        if (val === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, queryValue(val));
        }
      }
    }

    if (options?.orderBy) {
      for (const [key, val] of Object.entries(options.orderBy)) {
        query = query.order(key, { ascending: val === "asc" });
      }
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      console.error(`Error in findFirst for ${this.tableName}`, error);
      throw error;
    }
    return parseDates(data);
  }

  async create(options: { data: any }) {
    const supabase: any = getSupabaseAdmin();
    // Exclude nested writes like 'create' / 'connect' for relations
    const { locations, contacts, services, ...primaryData } = options.data;

    const row = { id: options.data.id ?? `${this.tableName}_${randomUUID()}`, ...primaryData };
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error(`Error in create for ${this.tableName}`, error);
      throw error;
    }

    return parseDates(data);
  }

  async update(options: { where: any; data: any }) {
    const supabase: any = getSupabaseAdmin();
    let query = supabase.from(this.tableName).update(options.data);
    for (const [key, val] of Object.entries(options.where)) {
      query = query.eq(key, queryValue(val));
    }
    const { data, error } = await query.select().single();
    if (error) {
      console.error(`Error in update for ${this.tableName}`, error);
      throw error;
    }
    return parseDates(data);
  }

  async upsert(options: { where: any; update: any; create: any }) {
    const existing = await this.findUnique({ where: options.where });
    if (existing) {
      if (Object.keys(options.update).length > 0) {
        return this.update({ where: options.where, data: options.update });
      }
      return existing;
    }
    return this.create({ data: options.create });
  }

  async count(options?: { where?: any }) {
    const supabase: any = getSupabaseAdmin();
    let query = supabase.from(this.tableName).select("*", { count: "exact", head: true });
    
    if (options?.where) {
      for (const [key, val] of Object.entries(options.where)) {
        if (key === "OR" && Array.isArray(val)) {
          const expressions = val.flatMap((condition: Record<string, any>) =>
            Object.entries(condition).map(([field, filter]) => {
              if (filter && typeof filter === "object" && "contains" in filter) {
                return `${field}.ilike.*${String(filter.contains).replace(/[,*()]/g, "")}*`;
              }
              return `${field}.eq.${String(filter)}`;
            })
          );
          if (expressions.length) query = query.or(expressions.join(","));
          continue;
        }
        if (val === null) {
          query = query.is(key, null);
        } else if (typeof val === "object" && val !== null) {
          if ("in" in val) {
            query = query.in(key, queryValue(val.in) as any[]);
          } else if ("notIn" in val) {
            query = query.not(key, "in", `(${(val.notIn as any[]).join(",")})`);
          } else if ("not" in val) {
            const notVal = (val as any).not;
            if (notVal === null) {
              query = query.not(key, "is", null);
            } else {
              query = query.neq(key, queryValue(notVal));
            }
          } else if ("contains" in val) {
            query = query.ilike(key, `%${val.contains}%`);
          } else if ("gte" in val) {
            query = query.gte(key, queryValue(val.gte));
          } else if ("lte" in val) {
            query = query.lte(key, queryValue(val.lte));
          }
        } else {
          query = query.eq(key, queryValue(val));
        }
      }
    }

    const { error, count } = await query;
    if (error) {
      console.error(`Error in count for ${this.tableName}`, error);
      throw error;
    }
    return count || 0;
  }

  async aggregate(options: { _sum?: Record<string, boolean>; where?: any }) {
    const supabase: any = getSupabaseAdmin();
    let query = supabase.from(this.tableName).select("*");
    
    if (options?.where) {
      for (const [key, val] of Object.entries(options.where)) {
        if (val === null) {
          query = query.is(key, null);
        } else if (typeof val === "object" && val !== null) {
          if ("notIn" in val) {
            query = query.not(key, "in", `(${(val.notIn as any[]).join(",")})`);
          } else if ("in" in val) {
            query = query.in(key, queryValue(val.in) as any[]);
          }
        } else {
          query = query.eq(key, queryValue(val));
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error in aggregate for ${this.tableName}`, error);
      throw error;
    }

    const result: any = { _sum: {} };
    if (options._sum) {
      for (const field of Object.keys(options._sum)) {
        const sum = data.reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);
        result._sum[field] = sum;
      }
    }
    return result;
  }

  async groupBy(options: { by: string[]; where?: any; _count?: boolean }) {
    const supabase: any = getSupabaseAdmin();
    let query = supabase.from(this.tableName).select("*");
    
    if (options?.where) {
      for (const [key, val] of Object.entries(options.where)) {
        if (val === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, queryValue(val));
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error in groupBy for ${this.tableName}`, error);
      throw error;
    }

    // Perform client-side grouping
    const groupings: Record<string, any> = {};
    for (const row of data) {
      const keys = options.by.map(field => row[field]).join("::");
      if (!groupings[keys]) {
        groupings[keys] = {
          _count: 0,
          values: options.by.reduce((o: any, f) => { o[f] = row[f]; return o; }, {})
        };
      }
      groupings[keys]._count++;
    }

    return Object.values(groupings).map((g: any) => ({
      ...g.values,
      _count: g._count
    }));
  }

  async delete(options: { where: any }) {
    const supabase: any = getSupabaseAdmin();
    let query = supabase.from(this.tableName).delete();
    for (const [key, val] of Object.entries(options.where)) {
      query = query.eq(key, queryValue(val));
    }
    const { data, error } = await query.select().maybeSingle();
    if (error) {
      console.error(`Error in delete for ${this.tableName}`, error);
      throw error;
    }
    return parseDates(data);
  }
}

export const db: any = {
  adminMember: new ModelAdapter<any>("admin_members"),
  adminSavedView: new ModelAdapter<any>("admin_saved_views"),
  clinic: new ModelAdapter<any>("prospect_clinics"),
  clinicLocation: new ModelAdapter<any>("prospect_locations"),
  clinicContact: new ModelAdapter<any>("prospect_contacts"),
  service: new ModelAdapter<any>("prospect_service_taxonomy"),
  clinicService: new ModelAdapter<any>("prospect_clinic_services"),
  clinicPipelineHistory: new ModelAdapter<any>("prospect_pipeline_history"),
  clinicImport: new ModelAdapter<any>("prospect_import_batches"),
  callSession: new ModelAdapter<any>("prospect_calls"),
  followUpTask: new ModelAdapter<any>("prospect_tasks"),
  deal: new ModelAdapter<any>("prospect_deals"),
  dealStageHistory: new ModelAdapter<any>("prospect_deal_history"),
  directoryProfile: new ModelAdapter<any>("prospect_directory_profiles"),
  activity: new ModelAdapter<any>("admin_audit_activities"),
  notification: new ModelAdapter<any>("admin_notifications"),
  
  // Shared projections mapping directly to existing Supabase tables
  publicClinic: new ModelAdapter<any>("Clinic"),
  publicClinicLocation: new ModelAdapter<any>("ClinicLocation"),
  clinicApplication: new ModelAdapter<any>("ClinicApplication"),
  article: new ModelAdapter<any>("Article"),
  assessmentSubmission: new ModelAdapter<any>("AssessmentSubmission"),
  
  // Transaction helpers (mock wrapper)
  $transaction: async (fn: (tx: any) => Promise<any>) => {
    return fn(db);
  }
};
