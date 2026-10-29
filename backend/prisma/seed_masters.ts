import { prisma } from '../src/config/db.js';

async function seedMasterData() {
  console.log('Seeding Master Data defaults...');
  const companies = await prisma.company.findMany({
    include: {
      branches: true,
      departments: true,
      designations: true,
      jobBands: true
    }
  });

  for (const company of companies) {
    console.log(`Processing company: ${company.name} (${company.id})`);

    // 1. Organizational Units
    const defaultUnits = [
      { code: 'UNIT-CORP-1', name: 'Corporate Unit 1', description: 'Central Executive & Corporate Operations Unit' },
      { code: 'UNIT-MFG-2', name: 'Manufacturing Unit 2', description: 'Industrial & Manufacturing Plant Operations' },
      { code: 'UNIT-RD-LAB', name: 'R&D Lab', description: 'Advanced Research, AI & Prototyping Laboratory' }
    ];

    for (const u of defaultUnits) {
      const existing = await prisma.orgUnit.findFirst({
        where: { companyId: company.id, code: u.code }
      });
      if (!existing) {
        await prisma.orgUnit.create({
          data: {
            companyId: company.id,
            branchId: company.branches[0]?.id || null,
            code: u.code,
            name: u.name,
            description: u.description,
            active: true
          }
        });
        console.log(`Created Unit: ${u.name}`);
      }
    }

    // 2. Employment Categories
    const defaultCategories = [
      { code: 'CAT-PERM', name: 'Permanent Staff', description: 'Regular Full-time Employees with standard benefits' },
      { code: 'CAT-EXEC', name: 'Executive Officer', description: 'Senior Corporate Executives and C-Suite Leadership' },
      { code: 'CAT-CONT', name: 'Contractual Specialist', description: 'Fixed-term contract specialists and technical consultants' }
    ];

    for (const c of defaultCategories) {
      const existing = await prisma.employmentCategory.findFirst({
        where: { companyId: company.id, code: c.code }
      });
      if (!existing) {
        await prisma.employmentCategory.create({
          data: {
            companyId: company.id,
            code: c.code,
            name: c.name,
            description: c.description,
            active: true
          }
        });
        console.log(`Created Category: ${c.name}`);
      }
    }

    // 3. Projects
    const defaultProjects = [
      { code: 'PRJ-OPS', name: 'Internal Operations', clientName: 'Apex Internal', status: 'ACTIVE' },
      { code: 'PRJ-ENG', name: 'Product Engineering', clientName: 'Platform Products', status: 'ACTIVE' },
      { code: 'PRJ-CS', name: 'Client Services', clientName: 'Enterprise Client Advisory', status: 'ACTIVE' }
    ];

    for (const p of defaultProjects) {
      const existing = await prisma.project.findFirst({
        where: { companyId: company.id, code: p.code }
      });
      if (!existing) {
        await prisma.project.create({
          data: {
            companyId: company.id,
            code: p.code,
            name: p.name,
            clientName: p.clientName,
            status: p.status,
            active: true
          }
        });
        console.log(`Created Project: ${p.name}`);
      }
    }

    // 4. Job Positions
    const engDept = company.departments.find(d => d.code === 'ENG') || company.departments[0];
    const devDes = company.designations.find(d => d.code.includes('ENG') || d.code.includes('DEV')) || company.designations[0];
    const l2Band = company.jobBands.find(b => b.code === 'L2') || company.jobBands[0];

    const defaultPositions = [
      { code: 'SE-2026', title: 'Senior Software Engineer (2026)', description: 'Lead enterprise payroll application backend & cloud engineering' },
      { code: 'PM-2026', title: 'Product Manager (2026)', description: 'Core HRMS & statutory compliance product manager' },
      { code: 'QA-2026', title: 'QA Automation Lead (2026)', description: 'End-to-end regression testing and test infrastructure lead' }
    ];

    for (const pos of defaultPositions) {
      const existing = await prisma.jobPosition.findFirst({
        where: { companyId: company.id, code: pos.code }
      });
      if (!existing) {
        await prisma.jobPosition.create({
          data: {
            companyId: company.id,
            departmentId: engDept?.id || null,
            designationId: devDes?.id || null,
            gradeId: l2Band?.id || null,
            code: pos.code,
            title: pos.title,
            description: pos.description,
            active: true
          }
        });
        console.log(`Created Job Position: ${pos.title}`);
      }
    }
  }

  console.log('Master data seeding complete!');
}

seedMasterData()
  .catch(err => {
    console.error('Master data seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
