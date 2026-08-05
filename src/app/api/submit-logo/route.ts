import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const CATEGORIES = [
  "금융","식품·음료","IT·테크","패션·뷰티","자동차",
  "유통·쇼핑","건설·중공업","엔터테인먼트","통신","의료·바이오",
  "소셜미디어","소프트웨어·개발","IT·클라우드","전자/IT","암호화폐","기타",
];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const nameKo   = (form.get("name_ko")   as string || "").trim();
    const nameEn   = (form.get("name_en")   as string || "").trim();
    const category = (form.get("category")  as string || "").trim();
    const domain   = (form.get("domain")    as string || "").trim();
    const memo     = (form.get("memo")      as string || "").trim();
    const file     = form.get("logo_file") as File | null;

    if (!nameKo || !nameEn || !category) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "유효하지 않은 카테고리" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.vibers.co.kr",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "jarvis",
        pass: process.env.SMTP_PASS,
      },
    });

    const attachments: nodemailer.Attachment[] = [];
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buffer,
        contentType: file.type,
      });
    }

    const recipient = process.env.LOGO_SUBMIT_EMAIL || "kgw2642@gmail.com";

    await transporter.sendMail({
      from: `"세모로고 제보" <jarvis@vibers.co.kr>`,
      to: recipient,
      subject: `[세모로고 로고제보] ${nameKo} (${nameEn})`,
      html: `
        <h2 style="font-family:sans-serif;margin-bottom:16px">🔺 새 로고 제보</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
          <tr><td style="padding:8px 12px;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7;width:120px">브랜드명 (한글)</td><td style="padding:8px 12px;border:1px solid #e4e4e7">${nameKo}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7">브랜드명 (영문)</td><td style="padding:8px 12px;border:1px solid #e4e4e7">${nameEn}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7">카테고리</td><td style="padding:8px 12px;border:1px solid #e4e4e7">${category}</td></tr>
          ${domain ? `<tr><td style="padding:8px 12px;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7">공식 홈페이지</td><td style="padding:8px 12px;border:1px solid #e4e4e7"><a href="${domain}">${domain}</a></td></tr>` : ""}
          ${memo ? `<tr><td style="padding:8px 12px;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7">메모</td><td style="padding:8px 12px;border:1px solid #e4e4e7">${memo}</td></tr>` : ""}
          <tr><td style="padding:8px 12px;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7">파일 첨부</td><td style="padding:8px 12px;border:1px solid #e4e4e7">${file?.name || "없음"}</td></tr>
        </table>
        <p style="font-family:sans-serif;font-size:12px;color:#71717a;margin-top:16px">세모로고 자동 발송 · semologo.com</p>
      `,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[submit-logo]", err);
    return NextResponse.json({ error: "전송 실패" }, { status: 500 });
  }
}
