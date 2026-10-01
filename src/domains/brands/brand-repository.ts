import { Database } from "@/infrastructure/database/client";
import { brands, Brand, NewBrand } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

export class BrandRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Brand | undefined> {
    const result = await this.db.select().from(brands).where(eq(brands.id, id)).get();
    return result;
  }

  async findByCode(code: string): Promise<Brand | undefined> {
    const result = await this.db.select().from(brands).where(eq(brands.code, code)).get();
    return result;
  }

  async findAll(): Promise<Brand[]> {
    return this.db.select().from(brands);
  }

  async create(data: NewBrand): Promise<Brand> {
    await this.db.insert(brands).values(data);
    const created = await this.findById(data.id);
    if (!created) throw new Error("Failed to create brand");
    return created;
  }
}
