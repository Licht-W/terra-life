# TL-M1-003 初回独立レビュー報告（Work担当）

レビュー日：2026-10-23 JST。指定されたWork側のファイル名 `TL-M1-003-astra-review.md` を使用する。ファイル名は実行モデルの検証証跡を意味しない。

## 1. 結論

**今回の限定範囲ではAC1〜AC9に適合。機能上の阻害指摘は認めなかった。** 既存341テスト、型確認、ビルドおよびレビュー側の追加5テストを隔離コピーで独立実行し、すべて成功した。

梱包メタデータについて低重大度の表記指摘1件（TL003-A-01）がある。コード修正を必要とする指摘ではない。外部のZIPハッシュ照合元は提供されておらず、配布元との一致は未確認。最終受入れ・他方レビューとの統合はTerra Life計画Workの担当であり、本報告はその判断を代行しない。

## 2. 対象と同一性

| 項目 | 確認内容 |
| --- | --- |
| タスク | TL-M1-003「季節進行・途中再開・死亡の最小コア」 |
| Snapshot ID | `TL-M1-003-20261023T014024JST-ff01a355583e` |
| ZIP | `TL-M1-003-20261023T014024JST-ff01a355583e.zip` |
| ZIP SHA-256（独立計算） | `f8e9ca2b312d1fc263ef5d5320ab1856015da99aa4fe4ea77105e1708cdf66f9` |
| 基準commit（manifest記載） | `c8cb50d2b19fce2797dddcfddede1d2f5f664d64` |
| 正本 | ZIP内 `worktree/`、35ファイル |
| 基準資料 | ZIP内 `baseline/`、32ファイル。実Gitオブジェクトとの外部照合は未実施 |
| 外部ZIPハッシュ | 依頼本文・添付に期待値／同名.sha256／完成後.verification.jsonなし。外部との一致は未確認 |
| 内部ハッシュ | `hashes.sha256`対象84ファイル、`manifest.files`対象83 payloadのSHA-256およびサイズを照合して一致 |
| 差分復元 | 隔離したbaselineコピーへ `complete-byte-exact.patch` をcheck・適用し、worktreeの35ファイルすべてがバイト一致 |
| 差分範囲 | 内容変更6ファイル＋`.gitignore`の改行のみの差分1ファイル。削除・改名なし |

内部ハッシュと復元一致はZIP内部の整合性の証拠であり、外部の作成報告や元リポジトリとの真正性を証明するものではない。レビュー終了前にも元ZIPハッシュ、展開payload、検証コピーの既存35ファイルの不変を照合した。

## 3. 手順・独立性・確認範囲

### 判断の順序

1. `README-FIRST.md`、`REVIEW-REQUEST.md`、`AGENTS.md`、独立レビュー方針を確認。
2. `specs/TL-M1-003-requirements.md`、`source-map.md`、出生採用差分、設計適用抜粋、実装契約・検証値を読んだ。実装契約は実装担当の具体化として扱い、ACを上書きする採用根拠とは扱わなかった。
3. 仕様v0.3.5の4.1、5.1、6、9.1、10、13.1を確認。新規コア全文・新規テスト全文と既存birth/randomの実装、依存定義・設定を照合。
4. 自己評価を読む前に「AC1〜7は静的適合、機能不具合未発見、AC8は実行待ち、AC9は文書監査待ち」と初回判断を記録。
5. その後に `verification/reported-results-summary.md`、`limitations.md`、タスクの自己評価・関連文書差分を参照し、独立実行結果と比較。

**独立性の限界：** セッションへ自動提供された過去会話の要約に、実装者による「341テスト・型確認・ビルド成功」等の短い自己報告が既に含まれていた。したがって完全な盲検状態ではない。これを検証根拠にせず、上記の初回コード判断と独立実行を行った。他方の今回のレビュー結果は取得・参照しておらず、開発会話全文や過去レビュー原文の追加取得も行っていない。初回判断後の文書差分監査には旧タスクの受入れ履歴への言及が含まれるが、今回の適合根拠として用いていない。

### 読解・監査した範囲

- `src/core/progression.ts`全体、実行時依存の`birth.ts`・`random.ts`、出生fixtureとの接続。
- `tests/progression.test.ts`全体。既存birth/randomテストも回帰実行対象とし、追加機能の検証とは区別。
- package.json、package-lock.json、3 tsconfig、Vite/Vitest設定、テストの副作用とimport経路。
- 新規タスク記録とREADME／project-context／設計書の差分。仕様本文、既存出生・乱数ソース、既存テスト、依存定義・設定の不変をバイト比較で確認。
- manifest、全payloadの整合性、完全差分の復元。旧レビュー原文など除外された資料の内容は監査していない。

重要区分の理由は、途中再開・二重適用防止・死亡・診断停止の状態契約を扱うため。今回はレビューのみで、コード・仕様・元ZIPは変更していない。追加テストと依存・ビルド生成物は隔離したレビュー用コピーにのみ作成した。commit・push・deploy・リモート更新は未実施。

## 4. 実行環境・独立実行結果

環境：Linux x86_64、Node.js **v24.19.0**、npm **11.9.0**。package.jsonのengine条件に適合。復元依存はVitest **4.1.12**、TypeScript **7.0.2**、Vite **8.3.4**。実装者のWindows環境とは異なる。

実行前にscriptsがVitest・tsc・Viteのみであることを確認。コア・テストにリモート更新処理なし。lockfileの`hasInstallScript`はmacOS向けoptionalのfseventsのみ。依存復元時は`--ignore-scripts`でライフサイクル実行を抑止した。テスト・ビルドはローカルのキャッシュ／dist書込みを伴うが、製品の外部I/Oは行わない。

| 独立実行 | 結果 |
| --- | --- |
| Python hashlibによるZIP・内部payload照合 | 成功。上記ハッシュ・サイズ一致 |
| `git -c core.autocrlf=false apply --check <patch>`、同コマンドの適用 | ともに終了0。復元35ファイルが一致 |
| `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` | レビューコピー内で終了0、55 packages追加、約9秒。lockfile変更なし |
| `npm test` | 終了0、3ファイル・341テスト成功（既存233＋新規108） |
| `npm run build` | 終了0。内部の`npm run typecheck`で3 tsconfig成功後、Viteで16 modulesをbuild |
| `npx --no-install vitest run tests/reviewer-extra.test.ts` | 終了0、レビュー専用の追加5テスト成功 |
| 終了前の不変確認 | ZIP、元payload、レビューコピーの既存35ファイルが一致 |

失敗・警告も区別する：最初の`npm ci`は私が作業ディレクトリを親scratchにしたため、lockfileを見つけられずEUSAGE・終了1となった。レビューコピーへ作業ディレクトリを訂正して上表の成功を得た。対象の依存定義の不具合ではない。npmは環境由来の`Unknown env config "http-proxy"`警告を出した。完全差分適用はCRLFを含む行に205件のwhitespace警告を出したが、適用後のバイト一致を確認した。警告を消す目的の正規化やソース修正はしていない。

### 追加検証の内容

1. 健康確認・季節完了・死亡・診断停止・copyCoreStateの各返却経路で、入力中の全ネストオブジェクトと返却中の全オブジェクトの参照集合が交差しない。
2. 健康0かつrevision上限では、死亡の部分確定をせず診断停止し、lastNormalとJSON往復結果が一致する。
3. seasonIndex上限−1から最後の安全な季節完了は成功し、その次の完了が診断停止する。
4. 上限状態でも古い入力は診断計算前に拒否。不正な外部状態は不正入力と組み合わされてもinvalid-stateとなる。
5. 状態・Origin・人物・乱数に未知の追加フィールドがあっても、既知フィールドだけを採用する実装契約に一致する。

追加テストの全文は末尾に収録する。元テストの期待値・製品API・製品コードは変えていない。

### 実装者の報告との区別

実装者の要約はWindows／PowerShell、Node v24.22.1、npm 11.19.1で341件・型確認・ビルド成功と報告している。過去の初回EPERMと型エラーも記録されている。保存済み生ログは未収録であり、その過去実行自体は独立に検証していない。本報告の成功判定は今回のLinux実行に基づく。実装者が報告した「文書リンク45件」「過去のGit状態」について同じ検証を実機で再実行したとは扱わない。

## 5. AC別判定

「適合」は本タスクの限定範囲・明示された境界契約に対する判定であり、将来のゲーム全体の完成判定ではない。

| AC | 判定 | 独立確認の根拠 |
| --- | --- | --- |
| AC1 | 適合 | connectBirthはstarted・seasonIndex=0と初期値／乱数の一致を確認しdraftを拒否。Origin、人物、乱数は既存copy関数と新規値構築で分離。既存freeze・変更テストと追加の全参照集合照合が成功 |
| AC2 | 適合 | check-health→complete-seasonではindex不変、次の完了でのみ+1。死亡記録の年齢・季節もindexから導出。春夏秋冬翌春・年齢増加テスト成功。年齢を別の可変状態として二重管理しない |
| AC3 | 適合 | lifeId／expectedRevision照合は遷移計算より前。成功ごとにrevision+1、拒否結果は置換状態を返さない。両段階・別人生・未来／古いrevision・再送の不変テスト成功 |
| AC4 | 適合 | stageが次の処理位置を保持。位置0〜15からJSON往復し、同一の残り入力列で20段階後の全状態に一致。死亡／診断包絡のJSON検証も成功。今回存在する2段階を対象とする |
| AC5 | 適合 | 接続時の健康0を保持し、最初の有効advanceで0歳春の死亡を確定。両stageで季節加算前に死亡判定。終端状態は以後拒否、履歴は整合した死亡1件。正の健康で精神0・資金0は死亡しない。整数安全限界の扱いは次節参照 |
| AC6 | 適合 | 不正外部状態はinvalid-stateのみでlastNormalを捏造しない。正常構造からの加算不能は独立コピーのlastNormalと原因位置を保持。原因の整合検証・部分更新防止・終端拒否のテスト成功 |
| AC7 | 適合 | progressionの実行時呼出しは非消費copy関数。通常進行で3系列・人物・Originは変わらず、履歴は空配列。React・DOM・時計・Math.random・保存API・外部I/O依存なし |
| AC8 | 適合 | lockfile復元、既存341テスト、3 tsconfig型確認、ビルド、追加5テストが独立実行で成功。環境差・初回操作失敗を別記 |
| AC9 | 適合 | タスク第1〜5章に範囲・判断・検証値・結果・残課題を記載。関連3文書を同期し、仕様本文・既存ソース等を保持。梱包の件数表記について非阻害指摘1件を付記 |

## 6. 重点境界の判断理由

- **二重適用防止の範囲：** 純粋関数なので同じ旧状態＋同じ入力を再評価すれば再び同じ成功結果になる。最新の受理状態へ呼出し側が差し替え、その状態への古い入力を拒否する契約である。lifeIdの一意性も呼出し側の責任として明記されている。これをグローバルロックや複数タブ整合性の実装済み保証とは扱わない。
- **健康0の接続：** connectBirth自体ではrunning／check-healthを返し、最初の有効advanceで死亡する。接続と進行を分けた今回の契約に整合し、死亡までに季節は進まない。出生段階で健康を引き上げる補正はない。
- **健康0とrevision上限の競合：** revisionを安全に増やせない場合、死亡を含む成功遷移を返さず診断停止する。これは成功時revision更新を守り、破綻した成功状態を返さないための数値安全契約と判断する。季節上限だけなら死亡は季節加算を必要としないため確定できる。通常の死亡を診断停止へ一律変換してはいない。
- **外部状態検証：** 版・数値・Origin・乱数・履歴／死亡・診断原因を検証するが、開始からの全到達性や全カウンター履歴の証明は行わない。後半季節の健康0や巨大カウンターを外部fixtureとして使うことは明示済み。これらを実際のゲーム進行で到達済みと主張しない。
- **再開の意味：** complete-seasonへ到達済みならJSON復帰後もそこから続行する。完了時に健康を再確認するが、前段階に戻って処理位置をやり直すものではない。現時点の健康確認自体には乱数・経済等の副作用がない。
- **後続機能との境界：** 直接死亡効果、イベント・連鎖・定期処理・経済・成長老化・冬の補充・UI・保存を先行実装していない。空の年に記録がないのは本タスクの限定経路であり、完成時の「生存年最低1記録」を撤回していない。

## 7. 指摘

### TL003-A-01 — manifestの変更件数で意味上の差分とバイト差分が区別されていない

- **重大度：低（文書・梱包メタデータのみ、受入れ阻害なし）。確度：確認済み。**
- **場所：** `manifest.json:8` のscopeと同ファイルchanges配列、`worktree/.gitignore`／`baseline/.gitignore`。
- **再現条件：** manifestのscopeは「全変更6件」。changes配列を数えると7件。baselineとworktreeをバイト比較しても7ファイルが異なる。
- **根拠：** `.gitignore`はbaselineのLFからworktreeのCRLFへの変更のみで、改行正規化後の内容は完全一致。内容変更は6件、バイト差分は7件である。完全差分はこの7件を収録し、35ファイルの復元一致を確認した。
- **影響：** 収録漏れやコード欠落はない。監査者が「全変更6件」をバイト単位の差分総数として読むと、changes配列や復元結果との不一致に見える。
- **修正方向：** 配布済みZIPは変更せず、統合記録または次回梱包時に「内容変更6件＋改行のみ1件、全バイト差分7件」と明記する。製品コード修正・本ZIPの再作成は本指摘の必須措置ではない。

機能上の指摘IDはない。仕様範囲外の機能欠如を不具合として追加していない。

## 8. 未確認事項と停止位置

- 外部のZIP SHA-256期待値、完成後の作成検証報告との照合。
- 基準commitの元Gitオブジェクト、元リポジトリの現在状態、リモート状態。基準SHAはmanifest記載として報告する。
- 実装者の過去実行の生ログ、Windowsでの再実行、その他のOS／Node版。
- UI／E2E、ブラウザ保存・正式セーブ移行、複数タブ、外部データの真正性、悪意あるgetter／Proxy等の非JSONオブジェクトへの耐性。
- イベント・直接死亡・経済・成長老化・冬補充等の後続機能、分布評価、一生生成。整数上限までの実進行は未実施。
- 他方レビューとの比較・結果統合、最終受入れ。

**初回レビュー報告の提出位置で停止する。** 修正・Git操作・公開・後続タスクには進まない。

## 付録：レビュー専用追加テスト

隔離したworktreeコピーにのみ`tests/reviewer-extra.test.ts`として配置し、`npx --no-install vitest run tests/reviewer-extra.test.ts`で実行した。製品に取り込む提案ではなく、今回の独立検証の再現用である。

```typescript
import { it, expect } from 'vitest'
import { createBirthDraft, startBirth } from '../src/core/birth'
import { BIRTH_FIXTURE } from '../src/content/birth-fixture'
import { connectBirth, advanceCore, copyCoreState } from '../src/core/progression'
import type { CoreResult, NormalState } from '../src/core/progression'
function state(r: CoreResult): NormalState { if(r.kind !== 'accepted') throw Error(r.kind); return r.state }
function initial() { const d=createBirthDraft('0123456789abcdef', BIRTH_FIXTURE); if(!d.ok) throw Error('draft'); const b=startBirth(d.value); if(!b.ok) throw Error('start'); return state(connectBirth(b.value,'reviewer')) }
function command(s: NormalState) { return {kind:'advance',lifeId:s.lifeId,expectedRevision:s.revision} }
function objects(x: unknown, seen=new Set<object>()): Set<object> { if(x && typeof x==='object' && !seen.has(x)) {seen.add(x); for(const v of Object.values(x)) objects(v,seen)} return seen }
function disjoint(a: unknown,b: unknown) { const left=objects(a); for(const obj of objects(b)) expect(left.has(obj)).toBe(false) }
it('all nested references are independent on both stages, death, stop and copy',()=>{
 const a=initial(); const b=state(advanceCore(a,command(a))); const c=state(advanceCore(b,command(b))); disjoint(a,b);disjoint(b,c);
 const z={...a,person:{...a.person,health:0}}; const d=state(advanceCore(z,command(z)));disjoint(z,d);
 const max={...a,revision:Number.MAX_SAFE_INTEGER}; const stop=advanceCore(max,command(max));expect(stop.kind).toBe('diagnostic-stop');if(stop.kind!=='diagnostic-stop')return;disjoint(max,stop.state);
 for(const s of [a,b,c,d,stop.state]) {const copied=copyCoreState(s);expect(copied.ok).toBe(true);if(copied.ok)disjoint(s,copied.value)}
})
it('zero health with exhausted revision is diagnostic, not partial death',()=>{
 const a=initial(); const s={...a,person:{...a.person,health:0},revision:Number.MAX_SAFE_INTEGER}; const r=advanceCore(s,command(s));expect(r.kind).toBe('diagnostic-stop');if(r.kind!=='diagnostic-stop')return;
 expect(r.state.lastNormal).toEqual(s);expect(r.state.lastNormal.history).toEqual([]);expect(copyCoreState(JSON.parse(JSON.stringify(r.state)))).toEqual({ok:true,value:r.state});
})
it('last safe season increment succeeds then next completion stops',()=>{
 const s={...initial(),seasonIndex:Number.MAX_SAFE_INTEGER-1,stage:'complete-season' as const};const a=state(advanceCore(s,command(s)));expect(a.seasonIndex).toBe(Number.MAX_SAFE_INTEGER);const b=state(advanceCore(a,command(a)));expect(advanceCore(b,command(b)).kind).toBe('diagnostic-stop');
})
it('invalid state takes precedence and stale commands cannot trigger limit diagnostics',()=>{
 const s={...initial(),revision:Number.MAX_SAFE_INTEGER};expect(advanceCore(s,{...command(s),expectedRevision:0}).kind).toBe('rejected');expect(advanceCore({...s,person:{...s.person,health:NaN}},null).kind).toBe('invalid-state');
})
it('unknown fields are discarded throughout known nested state',()=>{
 const s=initial();const extra={...s,unused:true,origin:{...s.origin,unused:true},person:{...s.person,unused:true},random:{...s.random,unused:true}};expect(copyCoreState(extra)).toEqual({ok:true,value:s});
})

```
