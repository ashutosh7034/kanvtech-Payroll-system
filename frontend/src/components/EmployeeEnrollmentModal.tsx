import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  User, 
  Upload, 
  Search, 
  Save, 
  X, 
  Check, 
  AlertCircle, 
  Calendar, 
  Paperclip, 
  FileText,
  Building,
  CreditCard
} from 'lucide-react';

interface EmployeeEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = 'EMPLOYMENT' | 'CONTACT' | 'STATUTORY' | 'PERSONAL' | 'UDF';

export const EmployeeEnrollmentModal: React.FC<EmployeeEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('EMPLOYMENT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Master data
  const [company, setCompany] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [jobBands, setJobBands] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<any[]>([]);

  // Photo preview
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Complete Form State across all 5 tabs
  const [formData, setFormData] = useState({
    // Header Identity
    title: 'Mr.',
    firstName: '',
    middleName: '',
    lastName: '',
    employeeCode: '',
    ticketNumber: '',

    // 1. Employment Tab - Org Placements
    jobPostCode: 'SE-2026',
    companyId: '',
    gradeId: '',
    branchId: '',
    departmentId: '',
    designationId: '',
    divisionId: '',
    unit: 'Corporate Unit 1',
    category: 'Permanent Staff',
    project: 'Internal Operations',

    // 1. Employment Tab - Employment Details
    gender: 'MALE',
    dateOfBirth: '1995-05-15',
    dateOfJoining: new Date().toISOString().split('T')[0],
    resignOfferDate: '',
    lastWorkingDate: '',
    probationDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    probationDays: 90,
    paymentMode: 'Bank',
    employmentType: 'PERMANENT',
    status: 'ACTIVE',
    workMode: 'OFFICE',
    remarks: '',
    freezeAccount: false,
    freezeDate: '',
    freezeReason: '',

    confirmDate: '',
    fnfRetiringDate: '',
    lastIncrementDate: new Date().toISOString().split('T')[0],
    processStartDate: new Date().toISOString().split('T')[0],
    groupJoinDate: '',
    jvCode: '',
    oldEmployeeCode: '',

    // 2. Contact Tab - Phone & Email
    residentialPhone: '',
    personalPhone: '',
    officePhone: '',
    extensionNo: '',
    microsoftUser: '',
    mobile: '',
    workEmail: '',
    personalEmail: '',
    ccEmail: '',
    googleUser: '',

    // 2. Contact Tab - Current Address
    currentPlot: '',
    currentStreet: '',
    currentArea: '',
    currentCity: '',
    currentDistrict: '',
    currentState: 'Maharashtra',
    currentPin: '',
    currentCountry: 'India',

    // Permanent Address
    sameAsCurrentAddress: true,
    permanentPlot: '',
    permanentStreet: '',
    permanentArea: '',
    permanentTown: '',
    permanentCity: '',
    permanentDistrict: '',
    permanentState: 'Maharashtra',
    permanentPin: '',

    // Family Details
    maritalStatus: 'UnMarried',
    fatherName: '',
    spouseName: '',
    children: 0,
    childrenInHostel: 0,

    // 3. Statutory Tab - PAN / UAN
    panNumber: '',
    uanNumber: '',
    aadhaarNumber: '',
    gratuityCode: '',
    pran: '',

    // Professional Tax
    ptFlag: 'Yes',
    ptNumber: '',

    // Provident Fund
    pfFlag: 'Yes',
    pfNumber: '',
    pfNewVersion: '',
    pfRemarks: '',
    electionCard: '',
    pfNationality: 'Indian',
    pfCountry: 'INDIA',
    isInternational: 'No',
    pfJoinDate: new Date().toISOString().split('T')[0],
    fpfNumber: '',
    vpfPercentage: 0,
    nprNumber: '',
    rationCard: '',
    educationQualification: 'Graduate',
    previousMemberId: '',

    // ESIC
    esicFlag: 'Yes',
    esicOldNo: '',
    esicImpCode: '',
    esicImpName: '',

    // 4. Personal Tab - General Details
    akaName: '',
    nationality: 'Indian',
    caste: '',
    anniversaryDate: '',
    weightKg: '',
    identificationMark: '',
    speciallyAbled: false,
    disabilityPercentage: '',
    typeOfChallenge: '',
    natureOfChallenge: '',
    personalRemark: '',
    placeOfBirth: '',
    religion: 'Hindu',
    subCaste: '',
    heightCm: '',
    bloodGroup: 'B+',

    // Banking & Official Names
    nameAsPerBank: '',
    nameAsPerAadhar: '',
    nameAsPerPan: '',
    bankName: 'HDFC Bank',
    bankAccountNumber: '',
    ifscCode: 'HDFC0001234',
    bankBranch: 'Main Branch',

    // 5. UDF Tab - Custom Fields
    customFields: {} as Record<string, string>,
    // Document uploads
    uploadedDocs: {} as Record<string, string>
  });

  // Load masters on modal mount
  useEffect(() => {
    if (!isOpen) return;

    const loadMasters = async () => {
      try {
        const [compRes, branchRes, deptRes, desigRes, jbRes, ccRes, cfRes]: any = await Promise.all([
          api.get('/org/company').catch(() => ({ company: { name: 'Stark Industries', legalName: 'Stark Industries Ltd.' } })),
          api.get('/org/branches').catch(() => ({ branches: [] })),
          api.get('/org/departments').catch(() => ({ departments: [] })),
          api.get('/org/designations').catch(() => ({ designations: [] })),
          api.get('/org/job-bands').catch(() => ({ jobBands: [] })),
          api.get('/org/cost-centers').catch(() => ({ costCenters: [] })),
          api.get('/employees/custom-fields/definitions').catch(() => ({ fields: [] }))
        ]);

        if (compRes?.company) setCompany(compRes.company);
        if (branchRes?.branches) {
          setBranches(branchRes.branches);
          if (branchRes.branches[0] && !formData.branchId) {
            setFormData(prev => ({ ...prev, branchId: branchRes.branches[0].id }));
          }
        }
        if (deptRes?.departments) {
          setDepartments(deptRes.departments);
          if (deptRes.departments[0] && !formData.departmentId) {
            setFormData(prev => ({ ...prev, departmentId: deptRes.departments[0].id }));
          }
        }
        if (desigRes?.designations) {
          setDesignations(desigRes.designations);
          if (desigRes.designations[0] && !formData.designationId) {
            setFormData(prev => ({ ...prev, designationId: desigRes.designations[0].id }));
          }
        }
        if (jbRes?.jobBands) {
          setJobBands(jbRes.jobBands);
          if (jbRes.jobBands[0] && !formData.gradeId) {
            setFormData(prev => ({ ...prev, gradeId: jbRes.jobBands[0].id }));
          }
        }
        if (ccRes?.costCenters) {
          setCostCenters(ccRes.costCenters);
          if (ccRes.costCenters[0] && !formData.divisionId) {
            setFormData(prev => ({ ...prev, divisionId: ccRes.costCenters[0].id }));
          }
        }
        if (cfRes?.fields) {
          setCustomFieldDefs(cfRes.fields);
        }
      } catch (err) {
        console.error('Error fetching master records:', err);
      }
    };

    loadMasters();
  }, [isOpen]);

  // Generate default employee code if empty
  useEffect(() => {
    if (isOpen && !formData.employeeCode) {
      const randomCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormData(prev => ({ ...prev, employeeCode: randomCode }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-calculated age
  const calculatedAge = formData.dateOfBirth
    ? Math.max(0, Math.floor((Date.now() - new Date(formData.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)))
    : 0;

  // Auto-calculated service months
  const calculatedServiceMonths = formData.dateOfJoining
    ? Math.max(0, Math.floor((Date.now() - new Date(formData.dateOfJoining).getTime()) / (30.44 * 24 * 3600 * 1000)))
    : 0;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyNamesFromMaster = () => {
    const fullName = `${formData.firstName} ${formData.middleName ? formData.middleName + ' ' : ''}${formData.lastName}`.trim();
    if (fullName) {
      setFormData(prev => ({
        ...prev,
        nameAsPerBank: fullName,
        nameAsPerAadhar: fullName,
        nameAsPerPan: fullName
      }));
    }
  };

  const handleDocFakeUpload = (key: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      uploadedDocs: {
        ...prev.uploadedDocs,
        [key]: name
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.firstName.trim()) {
      setActiveTab('EMPLOYMENT');
      setError('First Name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      setActiveTab('EMPLOYMENT');
      setError('Last Name is required');
      return;
    }
    if (!formData.employeeCode.trim()) {
      setActiveTab('EMPLOYMENT');
      setError('Employee Code is required');
      return;
    }
    if (!formData.branchId) {
      setActiveTab('EMPLOYMENT');
      setError('Branch is required');
      return;
    }
    if (!formData.departmentId) {
      setActiveTab('EMPLOYMENT');
      setError('Department is required');
      return;
    }
    if (!formData.designationId) {
      setActiveTab('EMPLOYMENT');
      setError('Designation is required');
      return;
    }

    const emailToSend = formData.workEmail.trim() || `${formData.employeeCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@${(company?.legalName || 'apexglobal').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    setSubmitting(true);
    try {
      // Map custom fields to array
      const customFieldValues = Object.entries(formData.customFields).map(([fieldDefinitionId, value]) => ({
        fieldDefinitionId,
        value
      }));

      const payload = {
        employeeCode: formData.employeeCode.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        workEmail: emailToSend,
        personalEmail: formData.personalEmail.trim() || undefined,
        phone: formData.mobile.trim() || formData.personalPhone.trim() || undefined,
        branchId: formData.branchId,
        departmentId: formData.departmentId,
        designationId: formData.designationId,
        jobBandId: formData.gradeId || undefined,
        costCenterId: formData.divisionId || undefined,
        dateOfJoining: formData.dateOfJoining,
        probationDays: Number(formData.probationDays) || 90,
        employmentType: formData.employmentType,
        workMode: formData.workMode,
        gender: formData.gender,
        panNumber: formData.panNumber.trim() || undefined,
        uanNumber: formData.uanNumber.trim() || undefined,
        bankName: formData.bankName.trim() || undefined,
        bankAccountNumber: formData.bankAccountNumber.trim() || undefined,
        ifscCode: formData.ifscCode.trim() || undefined,
        bankBranch: formData.bankBranch.trim() || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        maritalStatus: formData.maritalStatus,
        bloodGroup: formData.bloodGroup,
        emergencyContactName: formData.fatherName.trim() || formData.spouseName.trim() || undefined,
        emergencyContactPhone: formData.personalPhone.trim() || undefined,
        addressLine1: formData.currentPlot ? `${formData.currentPlot}, ${formData.currentStreet}, ${formData.currentArea}` : (formData.currentStreet || undefined),
        city: formData.currentCity || undefined,
        state: formData.currentState || undefined,
        pinCode: formData.currentPin || undefined,
        confirmationDate: formData.confirmDate || undefined,
        pfNumber: formData.pfNumber.trim() || undefined,
        esicNumber: formData.esicOldNo.trim() || undefined,
        aadhaarMasked: formData.aadhaarNumber.trim() || undefined,
        customFields: customFieldValues.length > 0 ? customFieldValues : undefined
      };

      await api.post('/employees', payload);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create employee:', err);
      setError(err.message || 'Failed to enroll employee. Please verify required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-spine-overlay" onClick={onClose}>
      <div className="modal-spine-workspace" onClick={e => e.stopPropagation()}>
        
        {/* TOP WINDOW HEADER */}
        <div className="spine-header-bar">
          <div className="spine-header-title">
            <h3>MANAGE EMPLOYEE</h3>
            <span className="spine-header-breadcrumb">HRIS / Employee / Manage Employee</span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* REGION 1: FIXED EMPLOYEE IDENTITY HEADER */}
        <div className="spine-identity-bar">
          {/* Avatar / Photo Upload */}
          <div className="spine-avatar-box">
            <div className="spine-avatar-circle">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Employee Avatar" />
              ) : (
                <User size={46} strokeWidth={1.5} />
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handlePhotoUpload} 
            />
            <button 
              type="button" 
              className="spine-avatar-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={11} /> Upload Photo
            </button>
          </div>

          {/* Identity Fields Grid */}
          <div className="spine-identity-fields">
            {/* Row 1: Title, First Name, Middle Name, Last Name */}
            <div className="spine-identity-row">
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Title</label>
                <select 
                  className="form-select" 
                  style={{ height: '30px', fontSize: '0.8125rem', padding: '2px 8px' }}
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Dr.">Dr.</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>First Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ height: '30px', fontSize: '0.8125rem', padding: '2px 8px' }}
                  placeholder="Enter First Name" 
                  required
                  value={formData.firstName} 
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Middle Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ height: '30px', fontSize: '0.8125rem', padding: '2px 8px' }}
                  placeholder="Enter Middle Name" 
                  value={formData.middleName} 
                  onChange={e => setFormData({ ...formData, middleName: e.target.value })} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Last Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ height: '30px', fontSize: '0.8125rem', padding: '2px 8px' }}
                  placeholder="Enter Last Name" 
                  required
                  value={formData.lastName} 
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })} 
                />
              </div>
            </div>

            {/* Row 2: Employee Code & Ticket / Tax Number */}
            <div className="spine-identity-row-2">
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Employee Code *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ height: '30px', fontSize: '0.8125rem', padding: '2px 8px', fontFamily: 'monospace' }}
                  placeholder="Enter Employee Code" 
                  required
                  value={formData.employeeCode} 
                  onChange={e => setFormData({ ...formData, employeeCode: e.target.value })} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Ticket Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ height: '30px', fontSize: '0.8125rem', padding: '2px 8px' }}
                  placeholder="Enter Ticket Number" 
                  value={formData.ticketNumber} 
                  onChange={e => setFormData({ ...formData, ticketNumber: e.target.value })} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* REGION 2: FIXED HORIZONTAL TAB BAR */}
        <div className="spine-tab-nav">
          <button 
            type="button" 
            className={`spine-tab-btn ${activeTab === 'EMPLOYMENT' ? 'active' : ''}`}
            onClick={() => setActiveTab('EMPLOYMENT')}
          >
            EMPLOYMENT
          </button>
          <button 
            type="button" 
            className={`spine-tab-btn ${activeTab === 'CONTACT' ? 'active' : ''}`}
            onClick={() => setActiveTab('CONTACT')}
          >
            CONTACT
          </button>
          <button 
            type="button" 
            className={`spine-tab-btn ${activeTab === 'STATUTORY' ? 'active' : ''}`}
            onClick={() => setActiveTab('STATUTORY')}
          >
            STATUTORY
          </button>
          <button 
            type="button" 
            className={`spine-tab-btn ${activeTab === 'PERSONAL' ? 'active' : ''}`}
            onClick={() => setActiveTab('PERSONAL')}
          >
            PERSONAL
          </button>
          <button 
            type="button" 
            className={`spine-tab-btn ${activeTab === 'UDF' ? 'active' : ''}`}
            onClick={() => setActiveTab('UDF')}
          >
            UDF
          </button>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div style={{ margin: '8px 24px', padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* REGION 3: INDEPENDENTLY SCROLLABLE FORM BODY */}
        <div className="spine-form-body">

          {/* ===================================================
              TAB 1: EMPLOYMENT
              =================================================== */}
          {activeTab === 'EMPLOYMENT' && (
            <div>
              {/* Broad Organizational Selectors */}
              <div className="spine-org-row">
                <span className="spine-org-label">Job Post Code *</span>
                <div className="spine-org-input-wrapper">
                  <input 
                    type="text" 
                    value={formData.jobPostCode} 
                    onChange={e => setFormData({ ...formData, jobPostCode: e.target.value })} 
                    placeholder="Select"
                  />
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Company *</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.companyId || (company?.id || '')} 
                    onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                  >
                    <option value={company?.id || 'default'}>{company?.legalName || company?.name || 'Stark Industries'}</option>
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Grade *</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.gradeId} 
                    onChange={e => setFormData({ ...formData, gradeId: e.target.value })}
                  >
                    <option value="">Select Grade</option>
                    {jobBands.map(jb => (
                      <option key={jb.id} value={jb.id}>{jb.name} ({jb.code})</option>
                    ))}
                    {jobBands.length === 0 && <option value="grade-1">Grade 1 (Executive)</option>}
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Branch *</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.branchId} 
                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                    required
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                    ))}
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Department *</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.departmentId} 
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Designation *</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.designationId} 
                    onChange={e => setFormData({ ...formData, designationId: e.target.value })}
                    required
                  >
                    <option value="">Select Designation</option>
                    {designations.map(des => (
                      <option key={des.id} value={des.id}>{des.name} ({des.code})</option>
                    ))}
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Division</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.divisionId} 
                    onChange={e => setFormData({ ...formData, divisionId: e.target.value })}
                  >
                    <option value="">Select Division</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                    ))}
                    {costCenters.length === 0 && <option value="div-1">Corporate Division</option>}
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Unit</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.unit} 
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="Corporate Unit 1">Corporate Unit 1</option>
                    <option value="Manufacturing Unit 2">Manufacturing Unit 2</option>
                    <option value="R&D Lab">R&D Lab</option>
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row">
                <span className="spine-org-label">Category</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Permanent Staff">Permanent Staff</option>
                    <option value="Executive Officer">Executive Officer</option>
                    <option value="Contractual Specialist">Contractual Specialist</option>
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              <div className="spine-org-row" style={{ marginBottom: '20px' }}>
                <span className="spine-org-label">Project</span>
                <div className="spine-org-input-wrapper">
                  <select 
                    value={formData.project} 
                    onChange={e => setFormData({ ...formData, project: e.target.value })}
                  >
                    <option value="Internal Operations">Internal Operations</option>
                    <option value="Product Engineering">Product Engineering</option>
                    <option value="Client Services">Client Services</option>
                  </select>
                  <Search size={14} className="spine-org-search-icon" />
                </div>
              </div>

              {/* Balanced Two-Column Employment Details */}
              <div className="spine-two-col-grid">
                {/* Left Column */}
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Gender *</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.gender} 
                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Birth Date *</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        required 
                        value={formData.dateOfBirth} 
                        onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Join Date *</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        required 
                        value={formData.dateOfJoining} 
                        onChange={e => setFormData({ ...formData, dateOfJoining: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Resign Offer Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.resignOfferDate} 
                        onChange={e => setFormData({ ...formData, resignOfferDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Last Working Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.lastWorkingDate} 
                        onChange={e => setFormData({ ...formData, lastWorkingDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Probation Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.probationDate} 
                        onChange={e => setFormData({ ...formData, probationDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Payment Mode *</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.paymentMode} 
                        onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                      >
                        <option value="Bank">Bank</option>
                        <option value="NEFT">NEFT / RTGS</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Employee Type</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.employmentType} 
                        onChange={e => setFormData({ ...formData, employmentType: e.target.value })}
                      >
                        <option value="PERMANENT">Permanent</option>
                        <option value="PROBATIONARY">Probationary</option>
                        <option value="CONTRACTUAL">Contractual</option>
                        <option value="CONSULTANT">Consultant</option>
                        <option value="INTERN">Intern</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Remarks</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Remarks" 
                        value={formData.remarks} 
                        onChange={e => setFormData({ ...formData, remarks: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row" style={{ marginTop: '4px' }}>
                    <span className="spine-field-label"></span>
                    <div className="spine-field-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="chkFreeze" 
                        checked={formData.freezeAccount} 
                        onChange={e => setFormData({ ...formData, freezeAccount: e.target.checked })} 
                      />
                      <label htmlFor="chkFreeze" style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 600 }}>Freeze Account</label>
                    </div>
                  </div>

                  {formData.freezeAccount && (
                    <>
                      <div className="spine-field-row">
                        <span className="spine-field-label">Freeze Date</span>
                        <div className="spine-field-control">
                          <input 
                            type="date" 
                            value={formData.freezeDate} 
                            onChange={e => setFormData({ ...formData, freezeDate: e.target.value })} 
                          />
                        </div>
                      </div>

                      <div className="spine-field-row">
                        <span className="spine-field-label">Freeze Reason</span>
                        <div className="spine-field-control">
                          <input 
                            type="text" 
                            placeholder="Enter Freeze Reason" 
                            value={formData.freezeReason} 
                            onChange={e => setFormData({ ...formData, freezeReason: e.target.value })} 
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column */}
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Status</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.status} 
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="PROBATION">Probation</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="NOTICE_PERIOD">Notice Period</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="EXITED">Exited</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Age</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        disabled 
                        value={`${calculatedAge} years`} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Confirm Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.confirmDate} 
                        onChange={e => setFormData({ ...formData, confirmDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">FnF Retiring Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.fnfRetiringDate} 
                        onChange={e => setFormData({ ...formData, fnfRetiringDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Last Increment Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.lastIncrementDate} 
                        onChange={e => setFormData({ ...formData, lastIncrementDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Service Months</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        disabled 
                        value={`${calculatedServiceMonths} months`} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Process Start Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.processStartDate} 
                        onChange={e => setFormData({ ...formData, processStartDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Group Join Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.groupJoinDate} 
                        onChange={e => setFormData({ ...formData, groupJoinDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">JV Code (Cr)</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter JV Code (Cr)" 
                        value={formData.jvCode} 
                        onChange={e => setFormData({ ...formData, jvCode: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Old Employee Code</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Old Employee Code" 
                        value={formData.oldEmployeeCode} 
                        onChange={e => setFormData({ ...formData, oldEmployeeCode: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
              TAB 2: CONTACT
              =================================================== */}
          {activeTab === 'CONTACT' && (
            <div>
              <div className="spine-section-heading">Contact Information</div>
              <div className="spine-two-col-grid">
                {/* Left Column */}
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Residential Phone</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Residential Phone" 
                        value={formData.residentialPhone} 
                        onChange={e => setFormData({ ...formData, residentialPhone: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Personal Phone</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Personal Phone" 
                        value={formData.personalPhone} 
                        onChange={e => setFormData({ ...formData, personalPhone: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Office Phone</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Office Phone" 
                        value={formData.officePhone} 
                        onChange={e => setFormData({ ...formData, officePhone: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Extension No.</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Extension No." 
                        value={formData.extensionNo} 
                        onChange={e => setFormData({ ...formData, extensionNo: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Microsoft User</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Microsoft User" 
                        value={formData.microsoftUser} 
                        onChange={e => setFormData({ ...formData, microsoftUser: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Mobile</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Mobile" 
                        value={formData.mobile} 
                        onChange={e => setFormData({ ...formData, mobile: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Email (Work)</span>
                    <div className="spine-field-control">
                      <input 
                        type="email" 
                        placeholder="Enter Official Email" 
                        value={formData.workEmail} 
                        onChange={e => setFormData({ ...formData, workEmail: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Alternate Email</span>
                    <div className="spine-field-control">
                      <input 
                        type="email" 
                        placeholder="Enter Alternate Email" 
                        value={formData.personalEmail} 
                        onChange={e => setFormData({ ...formData, personalEmail: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">CC Email</span>
                    <div className="spine-field-control">
                      <input 
                        type="email" 
                        placeholder="Enter CC Email" 
                        value={formData.ccEmail} 
                        onChange={e => setFormData({ ...formData, ccEmail: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Google User</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Google User" 
                        value={formData.googleUser} 
                        onChange={e => setFormData({ ...formData, googleUser: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div className="spine-section-heading">Current Address</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Plot / Flat</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Plot / Flat" 
                        value={formData.currentPlot} 
                        onChange={e => setFormData({ ...formData, currentPlot: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Street</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Street" 
                        value={formData.currentStreet} 
                        onChange={e => setFormData({ ...formData, currentStreet: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">City</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter City" 
                        value={formData.currentCity} 
                        onChange={e => setFormData({ ...formData, currentCity: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">PIN Code</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter PIN Code" 
                        value={formData.currentPin} 
                        onChange={e => setFormData({ ...formData, currentPin: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Area</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Area" 
                        value={formData.currentArea} 
                        onChange={e => setFormData({ ...formData, currentArea: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">District</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter District" 
                        value={formData.currentDistrict} 
                        onChange={e => setFormData({ ...formData, currentDistrict: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">State</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter State" 
                        value={formData.currentState} 
                        onChange={e => setFormData({ ...formData, currentState: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Country</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        value={formData.currentCountry} 
                        onChange={e => setFormData({ ...formData, currentCountry: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Family Details for Taxation */}
              <div className="spine-section-heading">Family Details (For Taxation)</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Marital Status</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.maritalStatus} 
                        onChange={e => setFormData({ ...formData, maritalStatus: e.target.value })}
                      >
                        <option value="UnMarried">UnMarried</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Children</span>
                    <div className="spine-field-control">
                      <input 
                        type="number" 
                        placeholder="Enter Children" 
                        value={formData.children} 
                        onChange={e => setFormData({ ...formData, children: Number(e.target.value) })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Children in Hostel</span>
                    <div className="spine-field-control">
                      <input 
                        type="number" 
                        placeholder="Enter Children in Hostel" 
                        value={formData.childrenInHostel} 
                        onChange={e => setFormData({ ...formData, childrenInHostel: Number(e.target.value) })} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Father Name</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Father Name" 
                        value={formData.fatherName} 
                        onChange={e => setFormData({ ...formData, fatherName: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Spouse Name</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Spouse Name" 
                        value={formData.spouseName} 
                        onChange={e => setFormData({ ...formData, spouseName: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
              TAB 3: STATUTORY
              =================================================== */}
          {activeTab === 'STATUTORY' && (
            <div>
              <div className="spine-section-heading">PAN / UAN</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">PAN</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        maxLength={10} 
                        placeholder="Enter PAN" 
                        style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                        value={formData.panNumber} 
                        onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">UAN No.</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        maxLength={12} 
                        placeholder="Enter UAN No." 
                        style={{ fontFamily: 'monospace' }}
                        value={formData.uanNumber} 
                        onChange={e => setFormData({ ...formData, uanNumber: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Aadhar Number</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        maxLength={12} 
                        placeholder="Enter Aadhar Number" 
                        style={{ fontFamily: 'monospace' }}
                        value={formData.aadhaarNumber} 
                        onChange={e => setFormData({ ...formData, aadhaarNumber: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Gratuity Code</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Gratuity Code" 
                        value={formData.gratuityCode} 
                        onChange={e => setFormData({ ...formData, gratuityCode: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">PRAN</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter PRAN" 
                        value={formData.pran} 
                        onChange={e => setFormData({ ...formData, pran: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional Tax */}
              <div className="spine-section-heading">P.T (Professional Tax)</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">PT Flag</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.ptFlag} 
                        onChange={e => setFormData({ ...formData, ptFlag: e.target.value })}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">P.T.No.</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter P.T.No." 
                        value={formData.ptNumber} 
                        onChange={e => setFormData({ ...formData, ptNumber: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Provident Fund */}
              <div className="spine-section-heading">P.F (Provident Fund)</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">PF Flag</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.pfFlag} 
                        onChange={e => setFormData({ ...formData, pfFlag: e.target.value })}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">PF No.</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter PF No." 
                        value={formData.pfNumber} 
                        onChange={e => setFormData({ ...formData, pfNumber: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">PF New Version</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter PF New Version" 
                        value={formData.pfNewVersion} 
                        onChange={e => setFormData({ ...formData, pfNewVersion: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">PF Remarks</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter PF Remarks" 
                        value={formData.pfRemarks} 
                        onChange={e => setFormData({ ...formData, pfRemarks: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Election Card</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Election Card" 
                        value={formData.electionCard} 
                        onChange={e => setFormData({ ...formData, electionCard: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">PF Nationality</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.pfNationality} 
                        onChange={e => setFormData({ ...formData, pfNationality: e.target.value })}
                      >
                        <option value="Indian">Indian</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Country</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.pfCountry} 
                        onChange={e => setFormData({ ...formData, pfCountry: e.target.value })}
                      >
                        <option value="INDIA">INDIA</option>
                        <option value="USA">USA</option>
                        <option value="UK">UK</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Is International</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.isInternational} 
                        onChange={e => setFormData({ ...formData, isInternational: e.target.value })}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">PF Join Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.pfJoinDate} 
                        onChange={e => setFormData({ ...formData, pfJoinDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">FPF No.</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter FPF No." 
                        value={formData.fpfNumber} 
                        onChange={e => setFormData({ ...formData, fpfNumber: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">VPF%</span>
                    <div className="spine-field-control">
                      <input 
                        type="number" 
                        placeholder="Enter VPF%" 
                        value={formData.vpfPercentage} 
                        onChange={e => setFormData({ ...formData, vpfPercentage: Number(e.target.value) })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">National Population Reg</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter National Population Register" 
                        value={formData.nprNumber} 
                        onChange={e => setFormData({ ...formData, nprNumber: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Ration Card</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Ration Card" 
                        value={formData.rationCard} 
                        onChange={e => setFormData({ ...formData, rationCard: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Education Qualification</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.educationQualification} 
                        onChange={e => setFormData({ ...formData, educationQualification: e.target.value })}
                      >
                        <option value="Others">Others</option>
                        <option value="Matriculate">Matriculate</option>
                        <option value="Higher Secondary">Higher Secondary</option>
                        <option value="Graduate">Graduate</option>
                        <option value="Post Graduate">Post Graduate</option>
                        <option value="Doctorate">Doctorate</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Previous Member Id</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Previous Member Id" 
                        value={formData.previousMemberId} 
                        onChange={e => setFormData({ ...formData, previousMemberId: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ESIC */}
              <div className="spine-section-heading">ESIC</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">ESIC Flag</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.esicFlag} 
                        onChange={e => setFormData({ ...formData, esicFlag: e.target.value })}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">ESIC Old No.</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter ESIC Old No." 
                        value={formData.esicOldNo} 
                        onChange={e => setFormData({ ...formData, esicOldNo: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">ESIC IMP Code</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter ESIC IMP Code" 
                        value={formData.esicImpCode} 
                        onChange={e => setFormData({ ...formData, esicImpCode: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">ESIC IMP Name</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter ESIC IMP Name" 
                        value={formData.esicImpName} 
                        onChange={e => setFormData({ ...formData, esicImpName: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
              TAB 4: PERSONAL
              =================================================== */}
          {activeTab === 'PERSONAL' && (
            <div>
              <div className="spine-section-heading">General Details</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">A.K.A. Name</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter A.K.A. Name" 
                        value={formData.akaName} 
                        onChange={e => setFormData({ ...formData, akaName: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Nationality</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Nationality" 
                        value={formData.nationality} 
                        onChange={e => setFormData({ ...formData, nationality: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Caste</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Caste" 
                        value={formData.caste} 
                        onChange={e => setFormData({ ...formData, caste: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Anniversary Date</span>
                    <div className="spine-field-control">
                      <input 
                        type="date" 
                        value={formData.anniversaryDate} 
                        onChange={e => setFormData({ ...formData, anniversaryDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Weight (kg.)</span>
                    <div className="spine-field-control">
                      <input 
                        type="number" 
                        placeholder="Enter Weight (kg.)" 
                        value={formData.weightKg} 
                        onChange={e => setFormData({ ...formData, weightKg: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Identification Mark</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Identification Mark" 
                        value={formData.identificationMark} 
                        onChange={e => setFormData({ ...formData, identificationMark: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row" style={{ marginTop: '6px' }}>
                    <span className="spine-field-label"></span>
                    <div className="spine-field-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="chkDivyaang" 
                        checked={formData.speciallyAbled} 
                        onChange={e => setFormData({ ...formData, speciallyAbled: e.target.checked })} 
                      />
                      <label htmlFor="chkDivyaang" style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 600 }}>Specially abled person (Divyaang)</label>
                    </div>
                  </div>

                  {formData.speciallyAbled && (
                    <div className="spine-field-row">
                      <span className="spine-field-label">Percentage (%)</span>
                      <div className="spine-field-control">
                        <input 
                          type="number" 
                          placeholder="Enter Percentage" 
                          value={formData.disabilityPercentage} 
                          onChange={e => setFormData({ ...formData, disabilityPercentage: e.target.value })} 
                        />
                      </div>
                    </div>
                  )}

                  <div className="spine-field-row">
                    <span className="spine-field-label">Personal Remark</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Personal Remark" 
                        value={formData.personalRemark} 
                        onChange={e => setFormData({ ...formData, personalRemark: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Place of Birth</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Place of Birth" 
                        value={formData.placeOfBirth} 
                        onChange={e => setFormData({ ...formData, placeOfBirth: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Religion</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Religion" 
                        value={formData.religion} 
                        onChange={e => setFormData({ ...formData, religion: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Sub Caste</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Sub Caste" 
                        value={formData.subCaste} 
                        onChange={e => setFormData({ ...formData, subCaste: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Height (cm.)</span>
                    <div className="spine-field-control">
                      <input 
                        type="number" 
                        placeholder="Enter Height (cm.)" 
                        value={formData.heightCm} 
                        onChange={e => setFormData({ ...formData, heightCm: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Blood Group</span>
                    <div className="spine-field-control">
                      <select 
                        value={formData.bloodGroup} 
                        onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                  </div>

                  {formData.speciallyAbled && (
                    <>
                      <div className="spine-field-row">
                        <span className="spine-field-label">Type of Challenge</span>
                        <div className="spine-field-control">
                          <select 
                            value={formData.typeOfChallenge} 
                            onChange={e => setFormData({ ...formData, typeOfChallenge: e.target.value })}
                          >
                            <option value="">Select Challenge Type</option>
                            <option value="Locomotor">Locomotor Disability</option>
                            <option value="Visual">Visual Impairment</option>
                            <option value="Hearing">Hearing Impairment</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="spine-field-row">
                        <span className="spine-field-label">Nature</span>
                        <div className="spine-field-control">
                          <input 
                            type="text" 
                            placeholder="Enter Nature of Disability" 
                            value={formData.natureOfChallenge} 
                            onChange={e => setFormData({ ...formData, natureOfChallenge: e.target.value })} 
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Copy Name Button */}
              <div style={{ margin: '14px 0 10px 0' }}>
                <button 
                  type="button" 
                  onClick={copyNamesFromMaster}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  COPY EMPLOYEE NAME FROM EMPLOYEE MASTER
                </button>
              </div>

              {/* Banking & Statutory Names */}
              <div className="spine-section-heading">Banking & Identity Names</div>
              <div className="spine-two-col-grid">
                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Name as per Bank</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Name as per Bank Passbook" 
                        value={formData.nameAsPerBank} 
                        onChange={e => setFormData({ ...formData, nameAsPerBank: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Name as per Aadhar</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Name as per Aadhar Card" 
                        value={formData.nameAsPerAadhar} 
                        onChange={e => setFormData({ ...formData, nameAsPerAadhar: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Bank Name</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Bank Name (e.g. HDFC Bank)" 
                        value={formData.bankName} 
                        onChange={e => setFormData({ ...formData, bankName: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Account Number *</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Bank Account Number" 
                        value={formData.bankAccountNumber} 
                        onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="spine-field-row">
                    <span className="spine-field-label">Name as per PAN</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Name as per PAN Card" 
                        value={formData.nameAsPerPan} 
                        onChange={e => setFormData({ ...formData, nameAsPerPan: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">IFSC Code *</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter IFSC Code" 
                        style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                        value={formData.ifscCode} 
                        onChange={e => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })} 
                      />
                    </div>
                  </div>

                  <div className="spine-field-row">
                    <span className="spine-field-label">Bank Branch</span>
                    <div className="spine-field-control">
                      <input 
                        type="text" 
                        placeholder="Enter Bank Branch" 
                        value={formData.bankBranch} 
                        onChange={e => setFormData({ ...formData, bankBranch: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
              TAB 5: UDF (Custom Fields & Documents)
              =================================================== */}
          {activeTab === 'UDF' && (
            <div>
              <div className="spine-section-heading">Document Attachments</div>
              
              {/* Document upload boxes matching reference */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {[
                  { key: 'bgr', label: 'Background Verification' },
                  { key: 'panDoc', label: 'PAN Card' },
                  { key: 'aadharDoc', label: 'Aadhar Card' },
                  { key: 'relievingLetter', label: 'Relieving Letter from Previous Company' },
                  { key: 'highestDegree', label: 'Highest Qualification Certificate' },
                  { key: 'latestSkill', label: 'Latest Skill Learning Certificate' }
                ].map(doc => (
                  <div key={doc.key}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      {doc.label}
                    </label>
                    <div className="spine-upload-box">
                      <span className="spine-upload-text">
                        {formData.uploadedDocs[doc.key] ? (
                          <span style={{ color: '#0d9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={14} /> {formData.uploadedDocs[doc.key]} (Attached)
                          </span>
                        ) : (
                          '(Only .pdf, .txt, .jpg, .png, .doc, .docx files are supported)'
                        )}
                      </span>
                      <button 
                        type="button" 
                        className="spine-upload-action"
                        style={{ background: 'none', border: 'none' }}
                        onClick={() => handleDocFakeUpload(doc.key, `${doc.label.replace(/\s+/g, '_')}_file.pdf`)}
                      >
                        <Upload size={13} /> Upload file 📤
                      </button>
                    </div>
                  </div>
                ))}

                {/* Health Checkup (date picker) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Health Checkup
                  </label>
                  <div style={{ maxWidth: '400px' }}>
                    <input 
                      type="date" 
                      className="form-input" 
                      style={{ height: '32px', fontSize: '0.8125rem' }} 
                    />
                  </div>
                </div>
              </div>

              {/* Configured UDF Custom Fields */}
              <div className="spine-section-heading">Configured User Defined Fields (UDF)</div>
              {customFieldDefs.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  No tenant-specific custom fields configured in Column Manager. Custom fields created in Settings will dynamically appear here.
                </p>
              ) : (
                <div className="spine-two-col-grid">
                  {customFieldDefs.map(cf => (
                    <div key={cf.id} className="spine-field-row">
                      <span className="spine-field-label">{cf.fieldLabel} {cf.isRequired && '*'}</span>
                      <div className="spine-field-control">
                        {cf.fieldType === 'DROPDOWN' ? (
                          <select 
                            value={formData.customFields[cf.id] || cf.defaultValue || ''} 
                            onChange={e => setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [cf.id]: e.target.value }
                            })}
                          >
                            <option value="">Select {cf.fieldLabel}</option>
                            {(cf.options || []).map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type={cf.fieldType === 'NUMBER' ? 'number' : cf.fieldType === 'DATE' ? 'date' : 'text'} 
                            placeholder={`Enter ${cf.fieldLabel}`}
                            value={formData.customFields[cf.id] || ''} 
                            onChange={e => setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [cf.id]: e.target.value }
                            })} 
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* REGION 4: FIXED BOTTOM ACTION BAR */}
        <div className="spine-bottom-bar">
          <button 
            type="button" 
            className="spine-btn-save" 
            onClick={handleSubmit} 
            disabled={submitting}
          >
            <Save size={14} /> {submitting ? 'SAVING...' : 'SAVE ALL'}
          </button>
          
          <button 
            type="button" 
            className="spine-btn-cancel" 
            onClick={onClose}
          >
            <X size={14} /> CANCEL
          </button>
        </div>

      </div>
    </div>
  );
};
