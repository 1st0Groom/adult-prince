"""Check GPU training prerequisites without downloading or training a model."""
import importlib
import importlib.metadata
import json
import sys
from pathlib import Path

packages = ('torch', 'transformers', 'peft', 'datasets', 'bitsandbytes', 'accelerate')
result = {'python': sys.version.split()[0], 'packages': {}, 'cuda_available': False, 'gpu_smoke': 'not-run', 'quantization_smoke': 'not-run', 'adapter_smoke': 'not-run', 'model_smoke': 'not-run', 'imports_smoke': 'not-run'}
for name in packages:
    try:
        result['packages'][name] = importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        result['packages'][name] = None

try:
    import torch
    if all(result['packages'].values()):
        try:
            for name in packages:
                importlib.import_module(name)
            result['imports_smoke'] = 'passed'
        except Exception as error:
            result['imports_smoke'] = f'failed: {type(error).__name__}: {error}'
    result['cuda_build'] = torch.version.cuda
    result['cuda_available'] = torch.cuda.is_available()
    if result['cuda_available']:
        result['gpu_name'] = torch.cuda.get_device_name(0)
        result['gpu_memory_gib'] = round(torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 2)
        x = torch.randn(16, 16, device='cuda', requires_grad=True)
        (x @ x).sum().backward()
        torch.cuda.synchronize()
        result['gpu_smoke'] = 'passed' if x.grad is not None else 'failed'
        if result['packages']['bitsandbytes']:
            try:
                bnb = importlib.import_module('bitsandbytes')
                layer = bnb.nn.Linear4bit(64, 64, bias=False, compute_dtype=torch.float16, quant_type='nf4').to('cuda')
                sample = torch.randn(1, 64, device='cuda', dtype=torch.float16, requires_grad=True)
                layer(sample).sum().backward()
                torch.cuda.synchronize()
                result['quantization_smoke'] = 'passed' if sample.grad is not None else 'failed'
                if result['packages']['peft']:
                    from peft import LoraConfig, get_peft_model

                    class TinyModel(torch.nn.Module):
                        def __init__(self):
                            super().__init__()
                            self.proj = bnb.nn.Linear4bit(64, 64, bias=False, compute_dtype=torch.float16, quant_type='nf4')
                            self.is_loaded_in_4bit = True

                        def forward(self, value):
                            return self.proj(value)

                    model = get_peft_model(TinyModel().to('cuda'), LoraConfig(r=4, lora_alpha=8, target_modules=['proj']))
                    trainable = [parameter for parameter in model.parameters() if parameter.requires_grad]
                    initial = [parameter.detach().clone() for parameter in trainable]
                    optimizer = torch.optim.AdamW(trainable, lr=0.001)
                    loss = model(torch.randn(2, 64, device='cuda', dtype=torch.float16)).float().pow(2).mean()
                    loss.backward()
                    optimizer.step()
                    torch.cuda.synchronize()
                    changed = any(not torch.equal(before, after) for before, after in zip(initial, trainable))
                    result['adapter_smoke'] = 'passed' if changed and bool(torch.isfinite(loss)) else 'failed'
            except Exception as error:
                result['quantization_smoke'] = f'failed: {type(error).__name__}: {error}'
except Exception as error:
    result['torch_error'] = f'{type(error).__name__}: {error}'

if result['adapter_smoke'] == 'passed':
    try:
        from transformers import Qwen3Config, Qwen3ForCausalLM, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        path = Path(__file__).resolve().parents[1] / 'work' / 'random-qwen-smoke'
        path.mkdir(parents=True, exist_ok=True)
        config = Qwen3Config(vocab_size=128, hidden_size=64, intermediate_size=128, num_hidden_layers=2, num_attention_heads=4, num_key_value_heads=2, head_dim=16, max_position_embeddings=64)
        Qwen3ForCausalLM(config).save_pretrained(path)
        quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_compute_dtype=torch.float16)
        model = Qwen3ForCausalLM.from_pretrained(path, quantization_config=quantization, device_map={'': 0}, local_files_only=True)
        model = prepare_model_for_kbit_training(model)
        model = get_peft_model(model, LoraConfig(r=4, lora_alpha=8, target_modules=['q_proj', 'v_proj'], task_type='CAUSAL_LM'))
        trainable = [parameter for parameter in model.parameters() if parameter.requires_grad]
        initial = [parameter.detach().clone() for parameter in trainable]
        optimizer = torch.optim.AdamW(trainable, lr=0.001)
        tokens = torch.randint(0, 128, (1, 16), device='cuda')
        loss = model(input_ids=tokens, labels=tokens).loss
        loss.backward()
        optimizer.step()
        torch.cuda.synchronize()
        changed = any(not torch.equal(before, after) for before, after in zip(initial, trainable))
        result['model_smoke'] = 'passed' if changed and bool(torch.isfinite(loss)) else 'failed'
        result['synthetic_trainable_parameters'] = sum(parameter.numel() for parameter in trainable)
    except Exception as error:
        result['model_smoke'] = f'failed: {type(error).__name__}: {error}'

result['training_prerequisites_ready'] = bool(result['cuda_available'] and all(result[key] == 'passed' for key in ['imports_smoke', 'gpu_smoke', 'quantization_smoke', 'adapter_smoke', 'model_smoke']) and all(result['packages'].values()))
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if result['training_prerequisites_ready'] else 1)
