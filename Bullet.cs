using UnityEngine;

public class Bullet : MonoBehaviour
{
    public int damage = 25;
    public float life = 2f;

    void Start() => Destroy(gameObject, life);

    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.TryGetComponent<Health>(out var hp))
        {
            hp.TakeDamage(damage);
            Destroy(gameObject);
        }
        else if (!other.isTrigger)
        {
            Destroy(gameObject);
        }
    }
}
