using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class EnemyAI : MonoBehaviour
{
    public float moveSpeed = 3.5f;
    public int touchDamage = 10;
    public float hitInterval = 0.7f;

    Rigidbody2D _rb;
    Transform _player;
    float _nextHit;

    void Awake()
    {
        _rb = GetComponent<Rigidbody2D>();
        var p = GameObject.FindGameObjectWithTag("Player");
        if (p) _player = p.transform;
    }

    void FixedUpdate()
    {
        if (!_player) return;
        Vector2 dir = (_player.position - transform.position).normalized;
        _rb.velocity = dir * moveSpeed;

        float angle = Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg - 90f;
        transform.rotation = Quaternion.Euler(0,0,angle);
    }

    void OnCollisionStay2D(Collision2D col)
    {
        if (col.collider.CompareTag("Player") && Time.time >= _nextHit)
        {
            _nextHit = Time.time + hitInterval;
            if (col.collider.TryGetComponent<Health>(out var hp))
                hp.TakeDamage(touchDamage);
        }
    }
}
