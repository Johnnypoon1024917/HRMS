/** Employee / Manager Self-Service view models. */

export interface MyAppointment {
  rankCode: string;
  basis: string;
  postTitle?: string;
  orgUnitName?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface MyProfile {
  staffId: string;
  staffNo: string;
  nameEn: string;
  nameZh?: string;
  sex: string;
  dob: string;
  idType: string;
  /** Always masked here — self-service never exposes raw sensitive IDs. */
  idNoMasked: string;
  currentRank?: string;
  currentUnit?: string;
  appointments: MyAppointment[];
  leaveSummary: { leaveTypeCode: string; remaining: number }[];
}

export interface TeamMember {
  staffId: string;
  staffNo: string;
  nameEn: string;
  rankCode?: string;
  orgUnitName?: string;
  onLeaveToday: boolean;
  pendingLeaveRequests: number;
}
