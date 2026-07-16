import Link from "next/link";
import { AccountRecoveryForm } from "@/components/auth/AccountRecoveryForm";

export default function FindAccountPage(){return <main className="page"><section className="hero"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>계정 찾기</h1><p className="description">등록된 이메일을 입력해 주세요.</p></section><AccountRecoveryForm mode="account"/><Link href="/login">로그인으로 돌아가기</Link></main>}
