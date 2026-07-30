import { AdminUserDetail } from "@/features/user-management/AdminUserDetail";
import styles from "../managementForms.module.css";

export default async function AdminUserDetailPage({params}:{params:Promise<{userPublicId:string}>}){const{userPublicId}=await params;return <AdminUserDetail publicId={userPublicId} styles={styles}/>}
