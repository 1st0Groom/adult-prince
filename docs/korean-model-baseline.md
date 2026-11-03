# Kanana·HyperCLOVA 예비평가 (2026-11-03)

RTX 3070 8GB, Ollama, 같은 가상 사례 10개. 원본 자체가 아니라 커뮤니티 Q4_K_M 변환본을 시험했다.

| 모델 | 형식 요구 | 일반 대화 진단 |
|---|---|---|
| Kanana 2.1B | 9/10 형식 통과 | 10/10 텍스트 생성, 허위 기억·주체 역전 발견 |
| HyperCLOVA 1.5B | 0/10 형식 통과 | 10/10 텍스트 생성, 허위 기억·주체 역전 발견 |

텍스트 생성은 품질 합격이 아니다. 일반 대화 진단은 --text-only로 짧은 자연어 지침과 실제 사용자 발화를 보내며, 구조화 평가와 입력 자체가 달라 차이를 JSON 요구 하나의 효과로 해석하면 안 된다.

## 관찰
Kanana 형식 평가에서는 기록 없는 과거를 모른다고 답하는 경우가 있었지만, 책을 주워준 기록에 “그게 처음이야. 그때부터 친해졌어”라는 관계 역사를 덧붙였다. 일반 대화에서는 여행 기억을 만들라는 입력에 바다·수영·음식을 지어냈고 책을 주워준 사람을 NPC로 바꿨다.

CLOVA는 요구 필드 대신 입력 요약 등 다른 JSON을 출력했다. 일반 대화에서는 첫 만남을 학교 앞 공원으로 지어냈고 책을 주워준 사람을 NPC로 바꿨다. 건강을 언급한 경우에는 쉬도록 배려하는 응답도 보였다.

## 실행 형식과 한계
Kanana 배포본의 Jinja 템플릿은 최초 구조화 실행에서 peg-native HTTP 500을 냈고 일반 대화에서 종료 토큰이 노출됐다. 원본 tokenizer_config의 역할 헤더를 확인해 config/models/kanana.Modelfile에서 도구 호출을 제외한 Llama3 계열 헤더와 종료 토큰을 명시했다. 표는 수정된 adult-prince-kanana:q4 결과다. 전체 원본 템플릿과 완전한 동등성을 검증한 것은 아니다.

CLOVA 원본 tokenizer_config는 로그인·접근 승인이 필요해 읽지 못했다. 공개 변환본에 Ollama가 적용한 ChatML 템플릿과 특수 토큰만 확인했다. 원본 접근 승인 후 공식 템플릿으로 재검증하기 전 모델 전체의 성능으로 일반화하지 않는다.

두 모델 모두 서비스 채택 보류. Kanana는 한국어 후보로 유지하고 독립 평가를 확대한다. 기억의 주체·대상·행동 구조화와 잘못 추가된 과거에 대한 검증이 필요하다. 실제 파인튜닝은 미실행이다.

## 출처와 이용조건
- [Kanana 원본](https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505): Apache 2.0
- [Kanana 변환본](https://huggingface.co/JJS0321/kanana-1.5-2.1b-instruct-2505-gguf)
- [CLOVA 원본](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B): 별도 SEED 라이선스
- [CLOVA 변환본](https://huggingface.co/kammbo/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF)

CLOVA 서비스 적용에는 원본 이용조건과 고지·Powered by HyperCLOVA X 표시 등을 적용해야 한다. 커뮤니티 변환이 원본 조건을 없애지 않는다. 원본 파일 접근 승인을 이번 시험에서 확보한 것은 아니다.

## 재실행
```
ollama create adult-prince-kanana:q4 -f config/models/kanana.Modelfile
npm run eval:ollama -- adult-prince-kanana:q4
npm run eval:ollama -- --text-only adult-prince-kanana:q4
```

원시 출력·파일 식별값·템플릿·입력 해시는 work/evaluations에 로컬 보관한다. 단일 요청 예비평가이며 동시접속과 장기 대화 품질은 미측정이다.
