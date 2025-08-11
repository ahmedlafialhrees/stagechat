using UnityEngine;
using UnityEngine.Events;

public class Health : MonoBehaviour
{
    public int maxHP = 100;
    public UnityEvent<int,int> onHealthChanged; // (current,max)
    public UnityEvent onDied;

    int _hp;

    void Awake() => _hp = maxHP;

    public void TakeDamage(int dmg)
    {
        _hp = Mathf.Max(0, _hp - dmg);
        onHealthChanged?.Invoke(_hp, maxHP);
        if (_hp == 0) Die();
    }

    public void Heal(int val)
    {
        _hp = Mathf.Min(maxHP, _hp + val);
        onHealthChanged?.Invoke(_hp, maxHP);
    }

    void Die()
    {
        onDied?.Invoke();
        Destroy(gameObject);
    }
}
