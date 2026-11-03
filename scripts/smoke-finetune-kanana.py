"""One synthetic-example GPU smoke test; output is not a production adapter."""
import json
from pathlib import Path
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

root = Path(__file__).resolve().parents[1]
base = root / 'work' / 'models' / 'kanana-1.5-2.1b'
output = root / 'work' / 'training-smoke' / 'kanana-adapter'
seed = root / 'data' / 'training' / 'seed-train.jsonl'
if not torch.cuda.is_available():
    raise RuntimeError('A CUDA-enabled GPU is required for this test')
if not (base / 'model.safetensors').is_file():
    raise RuntimeError('Local original Kanana model is not available')

torch.manual_seed(42)
item = json.loads(seed.read_text(encoding='utf-8').splitlines()[0])
messages = item['messages']
tokenizer = AutoTokenizer.from_pretrained(base, local_files_only=True)
prefix = tokenizer.apply_chat_template(messages[:2], tokenize=True, add_generation_prompt=True)
tokens = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False)
if len(tokens) > 512 or tokens[:len(prefix)] != prefix or len(tokens) <= len(prefix):
    raise RuntimeError('Unexpected chat template or sample length; not training')

quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
torch.cuda.reset_peak_memory_stats()
model = AutoModelForCausalLM.from_pretrained(base, quantization_config=quant, dtype=torch.float16, device_map={'': 0}, local_files_only=True)
model.config.use_cache = False
model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, LoraConfig(r=4, lora_alpha=8, target_modules=['q_proj', 'v_proj'], task_type='CAUSAL_LM'))
params = [parameter for parameter in model.parameters() if parameter.requires_grad]
before = [parameter.detach().clone() for parameter in params]
optimizer = torch.optim.AdamW(params, lr=0.0001)
input_ids = torch.tensor([tokens], device='cuda')
labels = input_ids.clone()
labels[:, :len(prefix)] = -100
loss = model(input_ids=input_ids, labels=labels).loss
if not bool(torch.isfinite(loss)):
    raise RuntimeError('Non-finite loss; adapter not saved')
loss.backward()
optimizer.step()
torch.cuda.synchronize()
changed = any(not torch.equal(previous, current) for previous, current in zip(before, params))
if not changed:
    raise RuntimeError('Adapter did not update; adapter not saved')
output.mkdir(parents=True, exist_ok=True)
model.save_pretrained(output)
print(json.dumps({'sample_id': item['id'], 'sample_count': 1, 'optimizer_steps': 1,
                  'input_tokens': len(tokens), 'assistant_tokens': len(tokens) - len(prefix),
                  'adapter_updated': changed, 'trainable_parameters': sum(p.numel() for p in params),
                  'peak_gpu_mib': round(torch.cuda.max_memory_allocated() / 1024**2, 1),
                  'adapter_path': str(output), 'production_ready': False}, ensure_ascii=False, indent=2))
