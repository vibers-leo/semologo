# 세모로고 MCP

**AI 에게 "여기 삼성 로고 넣어줘" 라고 말하면 끝.**
검색창을 열고, 받고, 이름 바꾸고, 폴더에 옮기는 일이 사라집니다.

세상 모든 로고([semologo.com](https://semologo.com)) 의 6,800여 개 브랜드 로고를
Claude Code · Cursor 같은 MCP 클라이언트에서 바로 가져다 씁니다.

## 설치

Claude Code:

```bash
claude mcp add semologo -- npx -y semologo-mcp
```

직접 설정할 때 (`claude_desktop_config.json` · `.cursor/mcp.json` 등):

```json
{
  "mcpServers": {
    "semologo": {
      "command": "npx",
      "args": ["-y", "semologo-mcp"]
    }
  }
}
```

## 쓰는 법

설치하고 나면 그냥 말하면 됩니다.

```
"헤더에 스타벅스랑 카카오 로고 넣어줘"
"결제 섹션에 카드사 로고들 붙여줘"
"이 SVG 를 public/logos 에 저장해줘"
```

## 도구

| 도구 | 하는 일 |
|---|---|
| `search_brands` | 이름·초성으로 브랜드를 찾습니다 (`삼성` · `samsung` · `ㅅㅅ`) |
| `get_logo` | **SVG 원문**을 그대로 돌려줍니다 — 코드에 바로 붙이면 됩니다 |
| `get_logo_url` | 파일 대신 CDN 주소만 (`<img src>` 로 쓸 때) |

## 서버가 없습니다

로고와 목록은 이미 공개 CDN 에 있고, 이미지는 Cloudflare 엣지에서 끝납니다.
이 프로그램은 **여러분 컴퓨터에서 돌면서 CDN 을 읽을 뿐**이라 계정도, API 키도,
사용량 제한도 없습니다.

그래서 이런 것들이 필요 없습니다:
- 회원가입·로그인·키 발급
- 사용량 확인, 요금제
- 저희 서버가 살아 있는지 걱정하기 — 저희가 멈춰도 CDN 은 그대로입니다

## 알아두면 좋은 것

- **한글 이름이 아직 없는 브랜드가 많습니다.** 예를 들어 `삼성` 으로 검색하면
  삼성화재·삼성증권은 나오지만 삼성 본체는 `samsung` 으로 찾아야 합니다.
  채워 넣는 중이에요.
- 찾는 브랜드가 없으면 [요청 게시판](https://semologo.com/request/)에 남겨주세요.

## 도움이 됐다면

세모로고는 광고로 굴러갑니다. 유용했다면 [커피 한 잔](https://buymeacoffee.com/vibers) ☕
