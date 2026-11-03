"""Small synthetic baseline/LoRA comparison; not a production training run."""
import hashlib
import json
import random
from datetime import datetime, timezone
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'work' / 'models' / 'qwen3-4b-instruct-2507'
TRAIN = ROOT / 'data' / 'training' / 'seed-train.jsonl'
HOLDOUT = ROOT / 'data' / 'training' / 'seed-holdout.jsonl'
GUIDELINES = (ROOT / 'config' / 'npc-dialogue-guidelines.txt').read_text(encoding='utf-8').strip()
REVISION = 'cdbee75f17c01a7cc42f958dc650907174af0554'
if not torch.cuda.is_available():
    raise RuntimeError('A CUDA-enabled GPU is required')
if not (BASE / 'model.safetensors.index.json').is_file():
    raise RuntimeError('Original Qwen model is not downloaded locally')

def read_cases(path):
    content = path.read_bytes()
    return [json.loads(line) for line in content.decode('utf-8').splitlines() if line.strip()], hashlib.sha256(content).hexdigest()

train, train_hash = read_cases(TRAIN)
holdout, holdout_hash = read_cases(HOLDOUT)
if not train or not holdout or set(item['id'] for item in train) & set(item['id'] for item in holdout):
    raise RuntimeError('Training and evaluation examples must be separate')
torch.manual_seed(42)
random.seed(42)
tokenizer = AutoTokenizer.from_pretrained(BASE, local_files_only=True)
def with_guidelines(messages):
    if not messages or messages[0].get('role') != 'system':
        raise RuntimeError('A scenario system message is required')
    return [{'role': 'system', 'content': GUIDELINES + '\n\n' + messages[0]['content']}, *messages[1:]]

examples = []
for item in train:
    messages = with_guidelines(item['messages'])
    if [message['role'] for message in messages] != ['system', 'user', 'assistant']:
        raise RuntimeError(f"Invalid conversation: {item['id']}")
    prefix = tokenizer.apply_chat_template(messages[:2], tokenize=True, add_generation_prompt=True)
    tokens = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False)
    if len(tokens) > 1024 or tokens[:len(prefix)] != prefix or len(tokens) <= len(prefix):
        raise RuntimeError(f"Invalid conversation tokenization: {item['id']}")
    examples.append((item['id'], tokens, len(prefix)))

quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
torch.cuda.reset_peak_memory_stats()
model = AutoModelForCausalLM.from_pretrained(BASE, quantization_config=quantization, dtype=torch.float16, device_map={'': 0}, local_files_only=True)
model.config.use_cache = False
model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, target_modules=['q_proj', 'v_proj'], task_type='CAUSAL_LM'))
params = [parameter for parameter in model.parameters() if parameter.requires_grad]
before_params = [parameter.detach().clone() for parameter in params]
optimizer = torch.optim.AdamW(params, lr=0.0001)

def evaluate():
    model.eval()
    output = []
    for item in holdout:
        prefix = tokenizer.apply_chat_template(with_guidelines(item['messages'][:2]), tokenize=True, add_generation_prompt=True)
        ids = torch.tensor([prefix], device='cuda')
        with torch.inference_mode():
            generated = model.generate(input_ids=ids, attention_mask=torch.ones_like(ids), max_new_tokens=96,
                                       do_sample=False, use_cache=True, pad_token_id=tokenizer.eos_token_id)
        text = tokenizer.decode(generated[0, ids.shape[1]:], skip_special_tokens=True).strip()
        output.append({'id': item['id'], 'category': item['category'], 'player': item['messages'][1]['content'],
                       'reply': text, 'reference': item['messages'][2]['content'], 'humanReview': None})
    return output

print('Generating baseline on 5 held-out examples...', flush=True)
baseline = evaluate()
model.train()
losses = []
for epoch in range(2):
    order = list(examples)
    random.shuffle(order)
    for item_id, tokens, prefix_length in order:
        ids = torch.tensor([tokens], device='cuda')
        labels = ids.clone()
        labels[:, :prefix_length] = -100
        optimizer.zero_grad(set_to_none=True)
        loss = model(input_ids=ids, attention_mask=torch.ones_like(ids), labels=labels).loss
        if not bool(torch.isfinite(loss)):
            raise RuntimeError(f'Non-finite loss in {item_id}; adapter not saved')
        loss.backward()
        optimizer.step()
        losses.append({'epoch': epoch + 1, 'id': item_id, 'loss': float(loss.detach().cpu())})
        print(f'epoch {epoch + 1} sample {item_id} loss {losses[-1]["loss"]:.4f}', flush=True)
torch.cuda.synchronize()
if not any(not torch.equal(old, new) for old, new in zip(before_params, params)):
    raise RuntimeError('Adapter did not update; not saving')
print('Generating responses after training...', flush=True)
after = evaluate()
timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
output = ROOT / 'work' / 'experiments' / f'qwen-seed-{timestamp}'
output.mkdir(parents=True, exist_ok=False)
model.save_pretrained(output / 'adapter')
report = {'base': 'Qwen/Qwen3-4B-Instruct-2507', 'revision': REVISION, 'trainHash': train_hash, 'holdoutHash': holdout_hash,
          'guidelinesHash': hashlib.sha256(GUIDELINES.encode('utf-8')).hexdigest(),
          'seed': 42, 'epochs': 2, 'steps': len(losses), 'trainExamples': len(train), 'heldOutExamples': len(holdout), 'maxTrainingTokens': 1024,
          'learningRate': 0.0001, 'lora': {'r': 8, 'alpha': 16, 'dropout': 0.05, 'targets': ['q_proj', 'v_proj']},
          'trainableParameters': sum(parameter.numel() for parameter in params),
          'peakGpuMib': round(torch.cuda.max_memory_allocated() / 1024**2, 1),
          'losses': losses, 'before': baseline, 'after': after, 'productionReady': False}
(output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'output': str(output), 'steps': len(losses), 'peakGpuMib': report['peakGpuMib'], 'productionReady': False}, ensure_ascii=False), flush=True)
