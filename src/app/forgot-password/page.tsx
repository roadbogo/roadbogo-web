import Link from "next/link";
import { AccountRecoveryForm } from "@/components/auth/AccountRecoveryForm";

export default function ForgotPasswordPage(){return <main className="page"><section className="hero"><p className="eyebrow">PASSWORD RESET</p><h1>비밀번호 재설정</h1><p className="description">등록된 이메일을 입력해 주세요.</p></section><AccountRecoveryForm mode="password"/><Link href="/login">로그인으로 돌아가기</Link></main>}
