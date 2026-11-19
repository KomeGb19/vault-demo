$api = "http://localhost:4000"

function Call-Api($method, $path, $body, $token) {
  $h = @{}
  if ($token) { $h.Authorization = "Bearer $token" }
  $p = @{ Method = $method; Uri = "$api$path"; Headers = $h; ContentType = "application/json" }
  if ($body) { $p.Body = ($body | ConvertTo-Json -Depth 5) }
  try { Invoke-RestMethod @p }
  catch {
    $code = [int]$_.Exception.Response.StatusCode
    $obj = $_.ErrorDetails.Message | ConvertFrom-Json
    $obj | Add-Member -NotePropertyName httpStatus -NotePropertyValue $code -Force
    $obj
  }
}
function Show($label, $obj) {
  Write-Host "`n== $label" -ForegroundColor Cyan
  $obj | ConvertTo-Json -Depth 6
}

$user = (Call-Api POST "/auth/login" @{ email = "t@t.com"; password = "secret123" }).token
Show "0. Reset" (Call-Api POST "/demo/reset" @{} $user)

$council = Call-Api POST "/vault/create" @{
  members = @("Member 1", "Member 2", "Member 3", "Member 4", "Member 5")
  homeAccount = @{ bank = "GTBank"; number = "0123456789"; name = "Ada Obi" }
} $user
$t = @($council.members | ForEach-Object { $_.token })

# --- Happy path -------------------------------------------------------
Show "1. Check: HOME account (expect APPROVED, delayHours 0)" (Call-Api POST "/api/payout/check" @{
  toAccount = @{ bank = "GTBank"; number = "0123456789" }; amount = 200000 } $user)

$new = Call-Api POST "/api/payout/check" @{
  toAccount = @{ bank = "OPay"; number = "9876543210"; name = "Chidi Unknown" }; amount = 200000 } $user
Show "2. Check: NEW account (expect BLOCKED, 0 of 3, 24h)" $new
$payoutId = $new.payoutId

Show "3a. Member 1 approves via sms (expect 1 of 3)" (Call-Api POST "/api/payout/approve" @{ payoutId = $payoutId; decision = "APPROVE"; channel = "sms" } $t[0])
Show "3b. Member 1 again (expect 409 already voted)" (Call-Api POST "/api/payout/approve" @{ payoutId = $payoutId; decision = "APPROVE" } $t[0])
Show "3c. User token tries to approve (expect 403)" (Call-Api POST "/api/payout/approve" @{ payoutId = $payoutId; decision = "APPROVE" } $user)
Show "3d. Member 2 approves via email (expect 2 of 3)" (Call-Api POST "/api/payout/approve" @{ payoutId = $payoutId; decision = "APPROVE"; channel = "email" } $t[1])
Show "3e. Member 3 approves via app (expect 3 of 3, still BLOCKED, WAITING_24H)" (Call-Api POST "/api/payout/approve" @{ payoutId = $payoutId; decision = "APPROVE"; channel = "app" } $t[2])
Show "3f. Member 4 approves (expect 409 enough approvals)" (Call-Api POST "/api/payout/approve" @{ payoutId = $payoutId; decision = "APPROVE" } $t[3])

Show "4. Advance 24h" (Call-Api POST "/demo/advance" @{ hours = 24 })
Show "5. AUDIT (expect APPROVED + full history)" (Call-Api GET "/api/audit/$payoutId" $null $t[0])

# --- Rejection path ---------------------------------------------------
$second = Call-Api POST "/api/payout/check" @{
  toAccount = @{ bank = "OPay"; number = "9876543210"; name = "Chidi Unknown" }; amount = 500000 } $user
$p2 = $second.payoutId
Show "6a. New payout, member 1 approves" (Call-Api POST "/api/payout/approve" @{ payoutId = $p2; decision = "APPROVE"; channel = "app" } $t[0])
Show "6b. Member 2 REJECTS (expect REJECTED)" (Call-Api POST "/api/payout/approve" @{ payoutId = $p2; decision = "REJECT"; channel = "whatsapp" } $t[1])
Show "6c. Member 3 approves after reject (expect 409 already REJECTED)" (Call-Api POST "/api/payout/approve" @{ payoutId = $p2; decision = "APPROVE" } $t[2])
Show "6d. AUDIT of rejected payout (owner token)" (Call-Api GET "/api/audit/$p2" $null $user)