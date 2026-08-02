export default function SubmitPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-4xl mb-4">🔺</p>
        <h1 className="text-2xl font-bold mb-2">로고 제보</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          등록을 원하는 브랜드 로고가 있으신가요?<br />
          제보해 주시면 검토 후 추가해 드릴게요.
        </p>
        <a
          href="mailto:vibers.leo@gmail.com?subject=세모로고 로고 제보"
          className="inline-flex items-center mt-6 px-5 py-2.5 rounded-full text-sm font-medium text-white"
          style={{ background: "#111" }}
        >
          이메일로 제보하기
        </a>
      </div>
    </div>
  );
}
